export class AlertController {
  constructor(model, view) {
    this.model = model;
    this.view = view;
  }

  async init() {
    // 1. Inicia o mapa conectando o clique
    this.view.initMap((lat, lng) => this.handlePointSelected(lat, lng));

    // 2. Vincula TODOS os eventos de botões e tela PRIMEIRO
    this.bindEvents();

    // 3. Renderiza o CRUD do LocalStorage
    this.refreshAlertsView();

    // 4. Carrega as camadas oficiais da PJF em segundo plano
    try {
      const layers = await this.model.loadAllRiskLayers();
      if (layers) {
        this.view.renderOfficialLayers(layers);
      }
    } catch (e) {
      console.warn("Camadas da PJF não carregadas, mantendo mapa operacional:", e);
    }
  }

  bindEvents() {
    // Busca de endereços
    const searchForm = document.getElementById("search-form");
    if (searchForm) {
      searchForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const query = document.getElementById("search-input").value;
        await this.handleAddressSearch(query);
      });
    }

    // Botão GPS
    const btnGps = document.getElementById("btn-gps");
    if (btnGps) {
      btnGps.addEventListener("click", () => {
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => this.handlePointSelected(pos.coords.latitude, pos.coords.longitude),
            () => alert("Não foi possível acessar a localização do dispositivo.")
          );
        }
      });
    }

    // Botões de Abrir/Fechar Modais
    const btnCreate = document.getElementById("btn-open-create");
    if (btnCreate) btnCreate.addEventListener("click", () => this.view.openFormModal());

    const btnCloseModal = document.getElementById("btn-close-modal");
    if (btnCloseModal) btnCloseModal.addEventListener("click", () => this.view.closeFormModal());

    const btnCancelForm = document.getElementById("btn-cancel-form");
    if (btnCancelForm) btnCancelForm.addEventListener("click", () => this.view.closeFormModal());

    // Modal Disclaimer
    const btnDisc = document.getElementById("btn-disclaimer");
    if (btnDisc) btnDisc.addEventListener("click", () => this.view.openDisclaimer());

    const btnCloseDisc = document.getElementById("btn-close-disclaimer");
    if (btnCloseDisc) btnCloseDisc.addEventListener("click", () => this.view.closeDisclaimer());

    const btnOkDisc = document.getElementById("btn-ok-disclaimer");
    if (btnOkDisc) btnOkDisc.addEventListener("click", () => this.view.closeDisclaimer());

    // Formulário Submit (Create / Update)
    if (this.view.form) {
      this.view.form.addEventListener("submit", (e) => {
        e.preventDefault();
        this.handleFormSubmit();
      });
    }

    // Filtros
    if (this.view.filterLevel) {
      this.view.filterLevel.addEventListener("change", () => this.refreshAlertsView());
    }
    if (this.view.filterThreat) {
      this.view.filterThreat.addEventListener("change", () => this.refreshAlertsView());
    }
  }

  // MÉTODO ATUALIZADO COM GEOCODIFICAÇÃO REVERSA EM TEMPO REAL:
  async handlePointSelected(lat, lng) {
    this.view.setQueryMarker(lat, lng);

    // 1. Descobre a Rua e o Bairro reais das coordenadas onde você clicou
    let enderecoReal = "Juiz de Fora";
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`
      );
      const data = await response.json();

      if (data && data.address) {
        const rua = data.address.road || data.address.pedestrian || data.address.avenue || "";
        const bairro = data.address.suburb || data.address.neighbourhood || data.address.city_district || "";

        if (rua && bairro) {
          enderecoReal = `${rua}, ${bairro}`;
        } else if (rua || bairro) {
          enderecoReal = rua || bairro;
        } else {
          enderecoReal = data.display_name.split(",")[0];
        }
      }
    } catch (err) {
      console.warn("Geocodificação reversa falhou, usando identificação local:", err);
    }

    // 2. Cruza o ponto com as bases oficiais da Defesa Civil (Turf.js)
    const diagnosticos = this.model.evaluatePointMultiRisk(lat, lng);

    // Se caiu dentro de uma mancha que tem o nome do bairro oficial da PJF, enriquece o nome
    if (diagnosticos.length > 0 && diagnosticos[0].bairro && diagnosticos[0].bairro !== "Juiz de Fora") {
      if (!enderecoReal.toLowerCase().includes(diagnosticos[0].bairro.toLowerCase())) {
        enderecoReal += ` (${diagnosticos[0].bairro})`;
      }
    }

    // 3. Renderiza o resultado com a RUA e BAIRRO identificados
    this.view.renderDiagnosis(diagnosticos, lat, lng, (diags, latitude, longitude) => {
      const prefill = {
        lat: latitude,
        lng: longitude,
        local: enderecoReal, // Nome real do logradouro/bairro
        ameaca: diags.length > 0 ? diags[0].ameaca : "Ponto de Atenção",
        nivel: diags.length > 0 ? diags[0].nivel : "R2"
      };
      this.view.openFormModal(null, prefill);
    });
  }

  async handleAddressSearch(query) {
    try {
      const fullQuery = `${query}, Juiz de Fora, MG, Brasil`;
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fullQuery)}`);
      const data = await response.json();

      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);
        this.handlePointSelected(lat, lon);
      } else {
        alert("Endereço não localizado em Juiz de Fora.");
      }
    } catch (err) {
      console.error(err);
      alert("Erro na consulta de endereço.");
    }
  }

  handleFormSubmit() {
    const id = this.view.fieldId.value;
    const payload = {
      local: this.view.fieldLocal.value,
      ameaca: this.view.fieldThreat.value,
      nivel: this.view.fieldLevel.value,
      status: this.view.fieldStatus.value,
      lat: parseFloat(this.view.fieldLat.value),
      lng: parseFloat(this.view.fieldLng.value),
      notas: this.view.fieldNotes.value
    };

    if (id) {
      this.model.updateAlert(id, payload);
    } else {
      this.model.createAlert(payload);
    }

    this.view.closeFormModal();
    this.refreshAlertsView();
  }

  handleEdit(id) {
    const item = this.model.getAlertById(id);
    if (item) this.view.openFormModal(item);
  }

  handleDelete(id) {
    if (confirm("Deseja realmente excluir este registro?")) {
      this.model.deleteAlert(id);
      this.refreshAlertsView();
    }
  }

  refreshAlertsView() {
    let alerts = this.model.getAllAlerts();
    const filterNivel = this.view.filterLevel ? this.view.filterLevel.value : "TODOS";
    const filterAmeaca = this.view.filterThreat ? this.view.filterThreat.value : "TODOS";

    if (filterNivel !== "TODOS") {
      alerts = alerts.filter((a) => a.nivel === filterNivel);
    }

    if (filterAmeaca !== "TODOS") {
      alerts = alerts.filter((a) => a.ameaca === filterAmeaca);
    }

    this.view.renderAlerts(
      alerts,
      (id) => this.handleEdit(id),
      (id) => this.handleDelete(id),
      (lat, lng) => this.view.focusLocation(lat, lng)
    );
  }
}