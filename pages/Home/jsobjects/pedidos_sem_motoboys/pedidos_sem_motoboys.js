export default {
  calcularComDetalhes: () => {
    const parseMySQLDate = (dateStr) => {
      if (!dateStr) return null;
      if (dateStr instanceof Date) return dateStr;
      return new Date(String(dateStr).replace('Z', ''));
    };

    const normalizarNumPed = (numped) => String(numped).trim();

    const pedidos = pedidos_nao_atrelados.data || [];
    const motoboys = motoboys_disponiveis.data || [];

    const resultados = pedidos.map(pedido => {
      const numPed = normalizarNumPed(pedido.numped);
      const filial = pedido.filial;
      const tempoDisponivel = parseMySQLDate(pedido.created_at_br);

      if (!tempoDisponivel || isNaN(tempoDisponivel.getTime())) {
        return null;
      }

      const motoboysDisponiveis = motoboys.filter(m => {
        if (m.filial_sigla !== filial) return false;
        const dataMotoboy = parseMySQLDate(m.created_at_br);
        if (!dataMotoboy || isNaN(dataMotoboy.getTime())) return false;
        return dataMotoboy <= tempoDisponivel;
      });

      const primeiroMotoboy = motoboys
        .filter(m => {
          if (m.filial_sigla !== filial) return false;
          const dataMotoboy = parseMySQLDate(m.created_at_br);
          if (!dataMotoboy || isNaN(dataMotoboy.getTime())) return false;
          return dataMotoboy > tempoDisponivel;
        })
        .sort((a, b) => {
          const dateA = parseMySQLDate(a.created_at_br);
          const dateB = parseMySQLDate(b.created_at_br);
          return dateA - dateB;
        })[0];

      const fimPeriodoSemMotoboy = primeiroMotoboy 
        ? parseMySQLDate(primeiroMotoboy.created_at_br)
        : new Date();

      const tempoSemMotoboyMinutos = motoboysDisponiveis.length === 0 
        ? (fimPeriodoSemMotoboy - tempoDisponivel) / (1000 * 60)
        : 0;

      return {
        numPed: numPed,
        filial: filial,
        tempoDisponivel: tempoDisponivel.toLocaleString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        }),
        fimPeriodo: fimPeriodoSemMotoboy.toLocaleString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        }),
        tempoSemMotoboyMinutos: Math.round(tempoSemMotoboyMinutos * 100) / 100,
        tempoSemMotoboyFormatado: `${Math.floor(tempoSemMotoboyMinutos)}m ${Math.round((tempoSemMotoboyMinutos % 1) * 60)}s`,
        motivoFim: primeiroMotoboy ? 'Motoboy ficou disponível' : 'Ainda aguardando',
        motoboysJaDisponiveis: motoboysDisponiveis.length,
        status: motoboysDisponiveis.length > 0 ? 'JÁ HAVIA MOTOBOY' : 'SEM MOTOBOY'
      };
    }).filter(r => r !== null);

    const pedidosSemMotoboy = resultados.filter(r => r.tempoSemMotoboyMinutos > 0);
    pedidosSemMotoboy.sort((a, b) => b.tempoSemMotoboyMinutos - a.tempoSemMotoboyMinutos);

    const totalSemMotoboy = pedidosSemMotoboy.reduce((sum, r) => sum + r.tempoSemMotoboyMinutos, 0);
    const mediaSemMotoboy = pedidosSemMotoboy.length > 0 ? totalSemMotoboy / pedidosSemMotoboy.length : 0;
    const maxSemMotoboy = pedidosSemMotoboy.length > 0 ? Math.max(...pedidosSemMotoboy.map(r => r.tempoSemMotoboyMinutos)) : 0;

    return {
      totalPedidos: resultados.length,
      pedidosComMotoboy: resultados.filter(r => r.status === 'JÁ HAVIA MOTOBOY').length,
      pedidosSemMotoboy: pedidosSemMotoboy.length,
      detalhes: pedidosSemMotoboy,
      amostraGeral: resultados.slice(0, 10),
      estatisticas: {
        totalOcorrencias: pedidosSemMotoboy.length,
        tempoTotalSemMotoboyMinutos: Math.round(totalSemMotoboy * 100) / 100,
        tempoMedioSemMotoboyMinutos: Math.round(mediaSemMotoboy * 100) / 100,
        tempoMaximoSemMotoboyMinutos: Math.round(maxSemMotoboy * 100) / 100,
        tempoTotalFormatado: `${Math.floor(totalSemMotoboy / 60)}h ${Math.round(totalSemMotoboy % 60)}m`
      },
      interpretacao: pedidosSemMotoboy.length === 0 
        ? '✅ EXCELENTE! Não há pedidos esperando por motoboys. Sempre há motoboys disponíveis quando os pedidos ficam prontos.'
        : '⚠️ Há pedidos esperando por motoboys (falta de motoboys na filial)'
    };
  },
  
  calcular: () => {
    // ... função original mantida ...
  }
};
