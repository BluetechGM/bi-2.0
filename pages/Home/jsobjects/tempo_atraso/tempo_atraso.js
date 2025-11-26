export default {
  calcularTempoOcioso: () => {
    // Mapeamento de CODFILIAL para Sigla
    const FILIAL_META_BY_CODFILIAL = {
      2: ['BRASILIA', 'DF'], 15: ['BRASILIA', 'DF'], 21: ['BRASILIA', 'DF'], 75: ['BRASILIA', 'DF'],
      3: ['RIO DE JANEIRO', 'RJ'], 31: ['RIO DE JANEIRO', 'RJ'], 16: ['RIO DE JANEIRO', 'RJ'], 76: ['RIO DE JANEIRO', 'RJ'],
      10: ['SAO PAULO', 'SP'], 13: ['SAO PAULO', 'SP'], 73: ['SAO PAULO', 'SP'],
      7: ['BELO HORIZONTE', 'MG'], 71: ['BELO HORIZONTE', 'MG'],
      12: ['CURITIBA', 'CTBA'], 72: ['CURITIBA', 'CTBA'],
      8: ['PORTO ALEGRE', 'RS'], 81: ['PORTO ALEGRE', 'RS'],
      4: ['UBERLANDIA', 'MG'], 41: ['UBERLANDIA', 'MG'], 14: ['UBERLANDIA', 'MG'], 74: ['UBERLANDIA', 'MG']
    };

    const deriveSigla = (cidade, uf) => {
      const removeAccents = (str) => {
        return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      };
      const base = removeAccents((cidade || '').toUpperCase());
      if (base.includes('BRASILIA')) return 'DF';
      if (base.includes('SAO PAULO')) return 'SP';
      if (base.includes('RIO DE JANEIRO')) return 'RJ';
      if (base.includes('BELO HORIZONTE')) return 'BH';
      if (base.includes('UBERLANDIA')) return 'UDI';
      if (base.includes('PORTO ALEGRE')) return 'POA';
      if (base.includes('CURITIBA')) return 'CTBA';
      return (uf || '').toUpperCase();
    };

    const codFilialToSigla = (codFilial) => {
      const meta = FILIAL_META_BY_CODFILIAL[codFilial];
      if (!meta) return 'UNKNOWN';
      return deriveSigla(meta[0], meta[1]);
    };

    const parseOracleDate = (dateStr) => {
      if (!dateStr) return null;
      if (dateStr instanceof Date) return dateStr;
      const str = String(dateStr).trim();
      if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(str)) {
        return new Date(str.replace(' ', 'T'));
      }
      if (/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}/.test(str)) {
        const [datePart, timePart] = str.split(' ');
        const [day, month, year] = datePart.split('/');
        return new Date(`${year}-${month}-${day}T${timePart}`);
      }
      return new Date(str);
    };

    const parseMySQLDate = (dateStr) => {
      if (!dateStr) return null;
      if (dateStr instanceof Date) return dateStr;
      return new Date(String(dateStr).replace('Z', ''));
    };

    const normalizarNumPed = (numped) => String(numped).trim();
    const normalizarMatricula = (matricula) => String(matricula).trim();

    // Obter dados das queries
    const pedidos = pedidos_nao_atrelados.data || [];
    const motoboys = motoboys_disponiveis.data || [];
    const saidas = saidas_motoboys.data || [];

    // Verificar se há dados
    if (saidas.length === 0) {
      return {
        detalhes: [],
        registrosComErro: [],
        estatisticas: {
          totalSaidas: 0,
          saidasComOciosidade: 0,
          percentualComOciosidade: 0,
          tempoTotalOciosoMinutos: 0,
          tempoMedioOciosoMinutos: 0,
          tempoMaximoOciosoMinutos: 0,
          tempoMinimoOciosoMinutos: 0,
          tempoTotalFormatado: '0h 0m'
        },
        porFilial: [],
        aviso: 'Nenhuma saída encontrada para hoje'
      };
    }

    // Processar cada saída
    const resultados = saidas.map(saida => {
      const codMotorista = normalizarMatricula(saida.CODMOTORISTA);
      const numPed = normalizarNumPed(saida.NUMPED);
      const dataSaidaBR = parseOracleDate(saida.DATASAIDA);
      const siglaFilial = codFilialToSigla(saida.CODFILIAL);

      if (!dataSaidaBR || isNaN(dataSaidaBR.getTime())) {
        return {
          saidaId: saida.SAIDAID,
          codMotorista: codMotorista,
          numPed: numPed,
          filial: siglaFilial,
          dataSaida: saida.DATASAIDA,
          erro: `Data de saída inválida: ${saida.DATASAIDA}`,
          tempoOciosoMinutos: 0,
          status: 'ERRO: Data inválida'
        };
      }

      // Encontrar o último registro de disponibilidade do motoboy ANTES da saída atual
      const motoboyDisp = motoboys
        .filter(m => {
          const matriculaMotoboy = normalizarMatricula(m.matricula);
          if (matriculaMotoboy !== codMotorista || m.filial_sigla !== siglaFilial) {
            return false;
          }
          const dataMotoboy = parseMySQLDate(m.created_at_br);
          if (!dataMotoboy || isNaN(dataMotoboy.getTime())) return false;
          return dataMotoboy <= dataSaidaBR;
        })
        .sort((a, b) => {
          const dateA = parseMySQLDate(a.created_at_br);
          const dateB = parseMySQLDate(b.created_at_br);
          return dateB - dateA;
        })[0];

      // Se encontrou disponibilidade, verificar se houve saída intermediária
      let tempoMotoboy = null;
      if (motoboyDisp) {
        tempoMotoboy = parseMySQLDate(motoboyDisp.created_at_br);
        
        // CRÍTICO: Verificar se há alguma SAÍDA deste motoboy entre a disponibilidade e a saída atual
        const saidasIntermediarias = saidas.filter(s => {
          const motoristaS = normalizarMatricula(s.CODMOTORISTA);
          const filialS = codFilialToSigla(s.CODFILIAL);
          const dataSaidaS = parseOracleDate(s.DATASAIDA);
          
          // Mesma matrícula e filial
          if (motoristaS !== codMotorista || filialS !== siglaFilial) return false;
          if (!dataSaidaS || isNaN(dataSaidaS.getTime())) return false;
          
          // Saída diferente da atual E entre disponibilidade e saída atual
          return s.SAIDAID !== saida.SAIDAID && 
                 dataSaidaS > tempoMotoboy && 
                 dataSaidaS < dataSaidaBR;
        });

        // Se houve saída intermediária, motoboy NÃO estava disponível
        if (saidasIntermediarias.length > 0) {
          tempoMotoboy = null;
        }
      }

      // Encontrar o último registro de disponibilidade do pedido ANTES da saída
      const pedidoDisp = pedidos
        .filter(p => {
          const numPedPedido = normalizarNumPed(p.numped);
          if (numPedPedido !== numPed || p.filial !== siglaFilial) {
            return false;
          }
          const dataPedido = parseMySQLDate(p.created_at_br);
          if (!dataPedido || isNaN(dataPedido.getTime())) return false;
          return dataPedido <= dataSaidaBR;
        })
        .sort((a, b) => {
          const dateA = parseMySQLDate(a.created_at_br);
          const dateB = parseMySQLDate(b.created_at_br);
          return dateB - dateA;
        })[0];

      // Calcular tempo ocioso
      let tempoOciosoMinutos = 0;
      let inicioOciosidade = null;
      let detalhesCalculo = null;

      if (tempoMotoboy && pedidoDisp) {
        const tempoPedido = parseMySQLDate(pedidoDisp.created_at_br);
        
        // Início da ociosidade = momento em que AMBOS estão disponíveis
        inicioOciosidade = new Date(Math.max(tempoMotoboy.getTime(), tempoPedido.getTime()));
        
        // Tempo ocioso = da disponibilidade simultânea até a saída
        tempoOciosoMinutos = (dataSaidaBR - inicioOciosidade) / (1000 * 60);
        
        // Garantir que não seja negativo
        tempoOciosoMinutos = Math.max(0, tempoOciosoMinutos);

        detalhesCalculo = {
          motoboyDisponivel: tempoMotoboy.toLocaleString('pt-BR'),
          pedidoDisponivel: tempoPedido.toLocaleString('pt-BR'),
          ambosDisponiveis: inicioOciosidade.toLocaleString('pt-BR'),
          saidaGerada: dataSaidaBR.toLocaleString('pt-BR'),
          diferencaMinutos: tempoOciosoMinutos.toFixed(2)
        };
      }

      return {
        saidaId: saida.SAIDAID,
        codMotorista: codMotorista,
        numPed: numPed,
        filial: siglaFilial,
        dataSaida: dataSaidaBR.toLocaleString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        }),
        tempoMotoboy: tempoMotoboy ? tempoMotoboy.toLocaleString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        }) : 'N/A',
        tempoPedido: pedidoDisp ? parseMySQLDate(pedidoDisp.created_at_br).toLocaleString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        }) : 'N/A',
        inicioOciosidade: inicioOciosidade ? inicioOciosidade.toLocaleString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        }) : 'N/A',
        tempoOciosoMinutos: Math.round(tempoOciosoMinutos * 100) / 100,
        tempoOciosoFormatado: tempoOciosoMinutos > 0 
          ? `${Math.floor(tempoOciosoMinutos)}m ${Math.round((tempoOciosoMinutos % 1) * 60)}s`
          : '0m 0s',
        detalhesCalculo: detalhesCalculo,
        status: !tempoMotoboy ? 'Sem registro de motoboy disponível' :
                !pedidoDisp ? 'Sem registro de pedido disponível' :
                tempoOciosoMinutos === 0 ? 'Sem ociosidade' : 'Com ociosidade'
      };
    });

    const resultadosValidos = resultados.filter(r => !r.erro);
    resultadosValidos.sort((a, b) => b.tempoOciosoMinutos - a.tempoOciosoMinutos);

    const totalOcioso = resultadosValidos.reduce((sum, r) => sum + r.tempoOciosoMinutos, 0);
    const mediaOcioso = resultadosValidos.length > 0 ? totalOcioso / resultadosValidos.length : 0;
    const saidasComOciosidade = resultadosValidos.filter(r => r.tempoOciosoMinutos > 0).length;
    const maxOcioso = resultadosValidos.length > 0 ? Math.max(...resultadosValidos.map(r => r.tempoOciosoMinutos)) : 0;
    const minOcioso = resultadosValidos.length > 0 && saidasComOciosidade > 0 ? 
      Math.min(...resultadosValidos.filter(r => r.tempoOciosoMinutos > 0).map(r => r.tempoOciosoMinutos)) : 0;

    const estatisticasPorFilial = {};
    resultadosValidos.forEach(r => {
      if (!estatisticasPorFilial[r.filial]) {
        estatisticasPorFilial[r.filial] = {
          totalSaidas: 0,
          saidasComOciosidade: 0,
          tempoTotalOcioso: 0
        };
      }
      estatisticasPorFilial[r.filial].totalSaidas++;
      if (r.tempoOciosoMinutos > 0) {
        estatisticasPorFilial[r.filial].saidasComOciosidade++;
        estatisticasPorFilial[r.filial].tempoTotalOcioso += r.tempoOciosoMinutos;
      }
    });

    const filiais = Object.keys(estatisticasPorFilial).map(sigla => {
      const stats = estatisticasPorFilial[sigla];
      const media = stats.totalSaidas > 0 ? stats.tempoTotalOcioso / stats.totalSaidas : 0;
      return {
        filial: sigla,
        totalSaidas: stats.totalSaidas,
        saidasComOciosidade: stats.saidasComOciosidade,
        percentualComOciosidade: stats.totalSaidas > 0 ? 
          Math.round((stats.saidasComOciosidade / stats.totalSaidas) * 100) : 0,
        tempoTotalOciosoMinutos: Math.round(stats.tempoTotalOcioso * 100) / 100,
        tempoMedioOciosoMinutos: Math.round(media * 100) / 100
      };
    }).sort((a, b) => b.tempoTotalOciosoMinutos - a.tempoTotalOciosoMinutos);

    return {
      detalhes: resultadosValidos,
      registrosComErro: resultados.filter(r => r.erro),
      estatisticas: {
        totalSaidas: resultadosValidos.length,
        saidasComOciosidade: saidasComOciosidade,
        percentualComOciosidade: resultadosValidos.length > 0 ? 
          Math.round((saidasComOciosidade / resultadosValidos.length) * 100) : 0,
        tempoTotalOciosoMinutos: Math.round(totalOcioso * 100) / 100,
        tempoMedioOciosoMinutos: Math.round(mediaOcioso * 100) / 100,
        tempoMaximoOciosoMinutos: Math.round(maxOcioso * 100) / 100,
        tempoMinimoOciosoMinutos: Math.round(minOcioso * 100) / 100,
        tempoTotalFormatado: `${Math.floor(totalOcioso / 60)}h ${Math.round(totalOcioso % 60)}m`
      },
      porFilial: filiais
    };
  }
};