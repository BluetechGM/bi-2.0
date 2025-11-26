export default {
  calcular: () => {
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

    const normalizarMatricula = (matricula) => String(matricula).trim();

    const motoboys = motoboys_disponiveis.data || [];
    const pedidos = pedidos_nao_atrelados.data || [];
    const saidas = saidas_motoboys.data || [];

    const resultados = motoboys.map(motoboy => {
      const matricula = normalizarMatricula(motoboy.matricula);
      const filial = motoboy.filial_sigla;
      const tempoDisponivel = parseMySQLDate(motoboy.created_at_br);

      if (!tempoDisponivel || isNaN(tempoDisponivel.getTime())) {
        return null;
      }

      const proximaSaida = saidas
        .filter(s => {
          const motoristaS = normalizarMatricula(s.CODMOTORISTA);
          const filialS = codFilialToSigla(s.CODFILIAL);
          const dataSaidaS = parseOracleDate(s.DATASAIDA);
          
          if (motoristaS !== matricula || filialS !== filial) return false;
          if (!dataSaidaS || isNaN(dataSaidaS.getTime())) return false;
          
          return dataSaidaS > tempoDisponivel;
        })
        .sort((a, b) => {
          const dateA = parseOracleDate(a.DATASAIDA);
          const dateB = parseOracleDate(b.DATASAIDA);
          return dateA - dateB;
        })[0];

      const limiteAnalise = proximaSaida 
        ? parseOracleDate(proximaSaida.DATASAIDA)
        : new Date();

      const pedidosDisponiveis = pedidos.filter(p => {
        if (p.filial !== filial) return false;
        const dataPedido = parseMySQLDate(p.created_at_br);
        if (!dataPedido || isNaN(dataPedido.getTime())) return false;
        return dataPedido <= tempoDisponivel;
      });

      if (pedidosDisponiveis.length > 0) {
        return null;
      }

      const primeiroPedido = pedidos
        .filter(p => {
          if (p.filial !== filial) return false;
          const dataPedido = parseMySQLDate(p.created_at_br);
          if (!dataPedido || isNaN(dataPedido.getTime())) return false;
          return dataPedido > tempoDisponivel && dataPedido < limiteAnalise;
        })
        .sort((a, b) => {
          const dateA = parseMySQLDate(a.created_at_br);
          const dateB = parseMySQLDate(b.created_at_br);
          return dateA - dateB;
        })[0];

      const fimPeriodoSemPedido = primeiroPedido 
        ? parseMySQLDate(primeiroPedido.created_at_br)
        : limiteAnalise;

      const tempoSemPedidoMinutos = (fimPeriodoSemPedido - tempoDisponivel) / (1000 * 60);

      return {
        matricula: matricula,
        filial: filial,
        tempoDisponivel: tempoDisponivel.toLocaleString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        }),
        fimPeriodo: fimPeriodoSemPedido.toLocaleString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        }),
        tempoSemPedidoMinutos: Math.round(tempoSemPedidoMinutos * 100) / 100,
        tempoSemPedidoFormatado: `${Math.floor(tempoSemPedidoMinutos)}m ${Math.round((tempoSemPedidoMinutos % 1) * 60)}s`,
        motivoFim: primeiroPedido ? 'Pedido ficou disponível' : (proximaSaida ? 'Saiu para entrega' : 'Ainda aguardando')
      };
    }).filter(r => r !== null);

    resultados.sort((a, b) => b.tempoSemPedidoMinutos - a.tempoSemPedidoMinutos);

    const totalSemPedido = resultados.reduce((sum, r) => sum + r.tempoSemPedidoMinutos, 0);
    const mediaSemPedido = resultados.length > 0 ? totalSemPedido / resultados.length : 0;
    const maxSemPedido = resultados.length > 0 ? Math.max(...resultados.map(r => r.tempoSemPedidoMinutos)) : 0;

    const estatisticasPorFilial = {};
    resultados.forEach(r => {
      if (!estatisticasPorFilial[r.filial]) {
        estatisticasPorFilial[r.filial] = {
          totalOcorrencias: 0,
          tempoTotalSemPedido: 0
        };
      }
      estatisticasPorFilial[r.filial].totalOcorrencias++;
      estatisticasPorFilial[r.filial].tempoTotalSemPedido += r.tempoSemPedidoMinutos;
    });

    const filiais = Object.keys(estatisticasPorFilial).map(sigla => {
      const stats = estatisticasPorFilial[sigla];
      const media = stats.totalOcorrencias > 0 ? stats.tempoTotalSemPedido / stats.totalOcorrencias : 0;
      return {
        filial: sigla,
        totalOcorrencias: stats.totalOcorrencias,
        tempoTotalSemPedidoMinutos: Math.round(stats.tempoTotalSemPedido * 100) / 100,
        tempoMedioSemPedidoMinutos: Math.round(media * 100) / 100
      };
    }).sort((a, b) => b.tempoTotalSemPedidoMinutos - a.tempoTotalSemPedidoMinutos);

    return {
      detalhes: resultados,
      estatisticas: {
        totalOcorrencias: resultados.length,
        tempoTotalSemPedidoMinutos: Math.round(totalSemPedido * 100) / 100,
        tempoMedioSemPedidoMinutos: Math.round(mediaSemPedido * 100) / 100,
        tempoMaximoSemPedidoMinutos: Math.round(maxSemPedido * 100) / 100,
        tempoTotalFormatado: `${Math.floor(totalSemPedido / 60)}h ${Math.round(totalSemPedido % 60)}m`
      },
      porFilial: filiais,
      interpretacao: 'Quanto MAIOR o tempo, mais MOTOBOYS OCIOSOS (excesso de motoboys na filial)'
    };
  }
};