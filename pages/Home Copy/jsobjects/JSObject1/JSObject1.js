export default {
  contatosTempoReal: {},
  _atualizando: false,

  async iniciarAtualizacao() {
    if (this._atualizando) {
      console.log("Já está rodando!");
      return;
    }
    
    this._atualizando = true;
    console.log("🚀 Iniciando atualização...");

    while (this._atualizando) {
      try {
        console.log("📊 Executando calculo_do_google...");
        await calculo_do_google.run();
        console.log("✅ calculo_do_google atualizado");
        await new Promise(r => setTimeout(r, 3000));

        console.log("📊 Executando pedidos_e_saidas_do_dia...");
        await pedidos_e_saidas_do_dia.run();
        console.log("✅ pedidos_e_saidas_do_dia atualizado");
        await new Promise(r => setTimeout(r, 3000));

        console.log("📊 Executando dmaplicativo_prod_rotas_otimiz...");
        await dmaplicativo_prod_rotas_otimiz.run();
        console.log("✅ dmaplicativo_prod_rotas_otimiz atualizado");
        await new Promise(r => setTimeout(r, 3000));

        console.log("📊 Executando ultimo_pedido_da_saida...");
        await ultimo_pedido_da_saida.run();
		
        console.log("✅ ultimo_pedido_da_saida atualizado");
        await new Promise(r => setTimeout(r, 3000));

        const pedidos = pedidos_e_saidas_do_dia.data || [];
        const calculo = calculo_do_google.data || { logistica_motoboy: [] };

        this.contatosTempoReal = {
          pedidos: pedidos,
          logistica: calculo.logistica_motoboy,
          atualizadoEm: new Date().toLocaleTimeString("pt-BR")
        };

        await storeValue("contatosTempoReal", this.contatosTempoReal);
        console.log("💾 Dados salvos:", this.contatosTempoReal.atualizadoEm);
        console.log("🔄 Reiniciando ciclo...\n");

      } catch (error) {
        console.log("❌ Erro:", error);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    console.log("⏹️ Atualização encerrada.");
  },

  pararAtualizacao() {
    this._atualizando = false;
    console.log("⏸️ Parando...");
  }
};