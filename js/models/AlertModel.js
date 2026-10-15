export class AlertModel {
  constructor() {
    this.storageKey = "alertaJF_ocorrencias_multirrisco";

    this.layers = {
      inundacao: null,
      enxurrada: null,
      corridaMassa: null
    };

    this.initSeedData();
  }

  // Registros de demonstração caso o LocalStorage esteja vazio
  initSeedData() {
    if (!localStorage.getItem(this.storageKey)) {
      const initialSeed = [
        {
          id: "seed-1",
          local: "Ponte de Santa Terezinha / Av. Brasil",
          ameaca: "Inundação",
          nivel: "R4",
          status: "Ativo",
          lat: -21.7485,
          lng: -43.3530,
          notas: "Nível da calha do Rio Paraibuna muito alto em chuvas contínuas.",
          atualizadoEm: "10/04/2026 14:20"
        },
        {
          id: "seed-2",
          local: "Encosta da Rua Divino Espírito Santo (Linhares)",
          ameaca: "Corrida de Massa",
          nivel: "R3",
          status: "Monitoramento",
          lat: -21.7580,
          lng: -43.3100,
          notas: "Talude saturado com trincas superficiais mapeadas.",
          atualizadoEm: "11/04/2026 09:15"
        }
      ];
      localStorage.setItem(this.storageKey, JSON.stringify(initialSeed));
    }
  }

  // Carrega com proteção contra falhas individuais
  async loadAllRiskLayers() {
    const fetchSafe = async (url) => {
      try {
        const res = await fetch(url);
        if (res.ok) return await res.json();
        return null;
      } catch (err) {
        console.warn(`Aviso: Não foi possível carregar ${url}:`, err);
        return null;
      }
    };

    this.layers.inundacao = await fetchSafe("./dados/inundacao.geojson");
    this.layers.enxurrada = await fetchSafe("./dados/enxurrada.geojson");
    this.layers.corridaMassa = await fetchSafe("./dados/corrida_massa.geojson");

    return this.layers;
  }

  // Análise espacial com Turf.js (Point-in-Polygon)
  evaluatePointMultiRisk(lat, lng) {
    if (typeof turf === "undefined") {
      console.error("Turf.js não foi carregado.");
      return [];
    }

    const point = turf.point([lng, lat]);
    const diagnosticos = [];

    const checkCollection = (geoJson, nomeAmeaca) => {
      if (!geoJson || !geoJson.features) return;

      for (const feat of geoJson.features) {
        try {
          if (turf.booleanPointInPolygon(point, feat)) {
            const props = feat.properties || {};
            diagnosticos.push({
              ameaca: nomeAmeaca,
              bairro: props.BAIRRO || props.bairro || props.Bairro || "Juiz de Fora",
              nivel: props.RISCO || props.risco || props.classificacao || "R3",
              processo: props.PROCESSO || props.processo || nomeAmeaca,
              populacao: props.POPULACAO || props.populacao || null,
              edificacoes: props.NO_EDIFICACOES || props.no_edificacoes || null,
              setor: props.SETOR || props.setor || "Setor Mapeado"
            });
          }
        } catch (e) {
          // Ignora feição com geometria inválida
        }
      }
    };

    checkCollection(this.layers.inundacao, "Inundação");
    checkCollection(this.layers.enxurrada, "Enxurrada");
    checkCollection(this.layers.corridaMassa, "Corrida de Massa");

    return diagnosticos;
  }

  // --- CRUD LOCALSTORAGE ---
  getAllAlerts() {
    try {
      const raw = localStorage.getItem(this.storageKey);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  getAlertById(id) {
    return this.getAllAlerts().find((item) => item.id === id);
  }

  createAlert(data) {
    const alerts = this.getAllAlerts();
    const newAlert = {
      ...data,
      id: "alerta_" + Date.now(),
      atualizadoEm: new Date().toLocaleDateString("pt-BR") + " " + new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    };
    alerts.unshift(newAlert);
    this._persist(alerts);
    return newAlert;
  }

  updateAlert(id, updatedData) {
    let alerts = this.getAllAlerts();
    alerts = alerts.map((item) => {
      if (item.id === id) {
        return {
          ...item,
          ...updatedData,
          atualizadoEm: new Date().toLocaleDateString("pt-BR") + " " + new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
        };
      }
      return item;
    });
    this._persist(alerts);
  }

  deleteAlert(id) {
    let alerts = this.getAllAlerts();
    alerts = alerts.filter((item) => item.id !== id);
    this._persist(alerts);
  }

  _persist(data) {
    localStorage.setItem(this.storageKey, JSON.stringify(data));
  }
}