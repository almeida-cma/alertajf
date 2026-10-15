export class AlertView {
  constructor() {
    this.map = null;
    this.markersCrudLayer = null;
    this.queryMarker = null;

    // Elementos DOM
    this.resultContainer = document.getElementById("result-content");
    this.alertsList = document.getElementById("alerts-list");
    this.alertsCount = document.getElementById("alerts-count");

    // Modais
    this.modalForm = document.getElementById("modal-form");
    this.modalTitle = document.getElementById("modal-title");
    this.form = document.getElementById("alert-form");
    this.modalDisclaimer = document.getElementById("modal-disclaimer");

    // Campos do formulário
    this.fieldId = document.getElementById("form-id");
    this.fieldLocal = document.getElementById("form-local");
    this.fieldThreat = document.getElementById("form-threat");
    this.fieldLevel = document.getElementById("form-level");
    this.fieldStatus = document.getElementById("form-status");
    this.fieldLat = document.getElementById("form-lat");
    this.fieldLng = document.getElementById("form-lng");
    this.fieldNotes = document.getElementById("form-notes");

    // Filtros
    this.filterLevel = document.getElementById("filter-level");
    this.filterThreat = document.getElementById("filter-threat");
  }

  initMap(onMapClick) {
    this.map = L.map("map").setView([-21.7607, -43.3496], 13);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors | SISURB / Defesa Civil PJF"
    }).addTo(this.map);

    this.markersCrudLayer = L.layerGroup().addTo(this.map);

    this.map.on("click", (e) => onMapClick(e.latlng.lat, e.latlng.lng));
  }

  // Renderiza as 3 camadas oficiais e adiciona o controle de camadas
  renderOfficialLayers(layersData) {
    const styleByLevel = (feature, defaultColor) => {
      const props = feature.properties || {};
      const nivel = props.RISCO || props.risco || props.classificacao || "";
      let color = defaultColor;
      if (nivel === "R4") color = "#dc2626";
      else if (nivel === "R3") color = "#ea580c";
      else if (nivel === "R2") color = "#eab308";
      else if (nivel === "R1") color = "#16a34a";

      return { color, fillColor: color, fillOpacity: 0.35, weight: 2 };
    };

    const overlays = {};

    if (layersData?.inundacao?.features) {
      const layerInundacao = L.geoJSON(layersData.inundacao, {
        style: (f) => styleByLevel(f, "#2563eb"),
        onEachFeature: (f, l) => l.bindTooltip(`<b>Inundação:</b> ${f.properties.BAIRRO || ""} (${f.properties.RISCO || ""})`)
      }).addTo(this.map);
      overlays["🌊 Inundações (Calha do Rio/Córregos)"] = layerInundacao;
    }

    if (layersData?.enxurrada?.features) {
      const layerEnxurrada = L.geoJSON(layersData.enxurrada, {
        style: (f) => styleByLevel(f, "#d97706"),
        onEachFeature: (f, l) => l.bindTooltip(`<b>Enxurrada:</b> ${f.properties.BAIRRO || ""} (${f.properties.RISCO || ""})`)
      }).addTo(this.map);
      overlays["⚡ Enxurradas (Drenagem/Vias)"] = layerEnxurrada;
    }

    if (layersData?.corridaMassa?.features) {
      const layerCorridaMassa = L.geoJSON(layersData.corridaMassa, {
        style: (f) => styleByLevel(f, "#7c2d12"),
        onEachFeature: (f, l) => l.bindTooltip(`<b>Corrida de Massa:</b> ${f.properties.BAIRRO || ""} (${f.properties.RISCO || ""})`)
      }).addTo(this.map);
      overlays["⛰️ Corrida de Massa / Deslizamentos"] = layerCorridaMassa;
    }

    if (Object.keys(overlays).length > 0) {
      L.control.layers(null, overlays, { collapsed: false }).addTo(this.map);
    }
  }

  // Apelido de compatibilidade para evitar erros de versão antiga
  renderSectors(layersData) {
    this.renderOfficialLayers(layersData);
  }

  setQueryMarker(lat, lng) {
    if (this.queryMarker) {
      this.queryMarker.setLatLng([lat, lng]);
    } else {
      this.queryMarker = L.marker([lat, lng]).addTo(this.map);
    }
    this.map.setView([lat, lng], 14);
  }

  renderDiagnosis(diagnosticos, lat, lng, onQuickCreate) {
    this.resultContainer.classList.remove("hidden");

    if (diagnosticos.length === 0) {
      this.resultContainer.innerHTML = `
        <div class="badge risk-seguro">NÍVEL BAIXO / MONITORADO</div>
        <h3 style="margin-top: 8px;">Ponto Fora de Setores Críticos</h3>
        <p style="font-size: 0.85rem; color: #475569; margin-top: 4px;">
          As coordenadas selecionadas não interceptam manchas críticas mapeadas de inundação, enxurrada ou deslizamento na base oficial da PJF.
        </p>
        <button id="btn-quick-add" class="btn-quick-create">+ Registrar Ponto de Atenção Aqui</button>
      `;
    } else {
      let html = `<h3 style="font-size: 0.95rem;">⚠️ Atenção: ${diagnosticos.length} Ameaça(s) Detectada(s)</h3>`;
      diagnosticos.forEach((d) => {
        const bgClass = `risk-${d.nivel.toLowerCase()}`;
        html += `
          <div class="diag-item">
            <div class="diag-item-header">
              <strong>${d.ameaca} (${d.processo})</strong>
              <span class="badge ${bgClass}">${d.nivel}</span>
            </div>
            <p style="font-size: 0.8rem; color: #334155;"><strong>Bairro:</strong> ${d.bairro} | <strong>Setor:</strong> ${d.setor}</p>
            ${d.populacao ? `<p style="font-size: 0.78rem; color: #64748b;">População estimada no setor: ${d.populacao} pessoas</p>` : ""}
          </div>
        `;
      });

      html += `<button id="btn-quick-add" class="btn-quick-create">+ Salvar Alerta com Dados Deste Local</button>`;
      this.resultContainer.innerHTML = html;
    }

    const btnQuick = document.getElementById("btn-quick-add");
    if (btnQuick) {
      btnQuick.addEventListener("click", () => onQuickCreate(diagnosticos, lat, lng));
    }
  }

  renderAlerts(alerts, onEdit, onDelete, onFocus) {
    this.markersCrudLayer.clearLayers();
    this.alertsList.innerHTML = "";
    this.alertsCount.textContent = `${alerts.length} registros`;

    if (alerts.length === 0) {
      this.alertsList.innerHTML = "<p class='hint-text' style='text-align: center; padding: 12px;'>Nenhum registro encontrado para este filtro.</p>";
      return;
    }

    alerts.forEach((alert) => {
      const colorMap = { R4: "#dc2626", R3: "#ea580c", R2: "#eab308", R1: "#16a34a" };
      const marker = L.circleMarker([alert.lat, alert.lng], {
        radius: 8,
        fillColor: colorMap[alert.nivel] || "#2563eb",
        color: "#ffffff",
        weight: 2,
        fillOpacity: 0.95
      }).bindPopup(`
        <strong>${alert.local}</strong><br>
        Ameaça: <b>${alert.ameaca}</b> (${alert.nivel})<br>
        Status: ${alert.status}<br>
        <small>${alert.notas || ""}</small>
      `);

      this.markersCrudLayer.addLayer(marker);

      const item = document.createElement("div");
      item.className = `alert-item border-${(alert.nivel || "r3").toLowerCase()}`;
      item.innerHTML = `
        <div class="alert-top">
          <strong style="font-size: 0.9rem;">${alert.local}</strong>
          <span class="badge bg-${(alert.nivel || "r3").toLowerCase()}">${alert.nivel}</span>
        </div>
        <div class="alert-details">
          <span>${alert.ameaca}</span> | <span>Status: <strong>${alert.status}</strong></span><br>
          <small>Atualizado em: ${alert.atualizadoEm}</small>
        </div>
        ${alert.notas ? `<p style="font-size: 0.78rem; background: #f8fafc; padding: 4px; border-radius: 4px;">📝 ${alert.notas}</p>` : ""}
        <div class="alert-actions">
          <button class="btn-edit btn-ver">🎯 Localizar</button>
          <button class="btn-edit btn-editar">✏️ Editar</button>
          <button class="btn-delete btn-excluir">🗑️ Excluir</button>
        </div>
      `;

      item.querySelector(".btn-ver").addEventListener("click", () => onFocus(alert.lat, alert.lng));
      item.querySelector(".btn-editar").addEventListener("click", () => onEdit(alert.id));
      item.querySelector(".btn-excluir").addEventListener("click", () => onDelete(alert.id));

      this.alertsList.appendChild(item);
    });
  }

  openFormModal(data = null, prefill = null) {
    this.modalForm.classList.remove("hidden");
    this.form.reset();

    if (data) {
      this.modalTitle.textContent = "Editar Alerta / Ponto de Atenção";
      this.fieldId.value = data.id;
      this.fieldLocal.value = data.local;
      this.fieldThreat.value = data.ameaca;
      this.fieldLevel.value = data.nivel;
      this.fieldStatus.value = data.status;
      this.fieldLat.value = data.lat;
      this.fieldLng.value = data.lng;
      this.fieldNotes.value = data.notas || "";
    } else {
      this.modalTitle.textContent = "Registrar Novo Alerta / Ponto";
      this.fieldId.value = "";
      this.fieldLat.value = prefill ? Number(prefill.lat).toFixed(5) : "-21.7607";
      this.fieldLng.value = prefill ? Number(prefill.lng).toFixed(5) : "-43.3496";
      this.fieldLocal.value = prefill?.local || "";
      this.fieldThreat.value = prefill?.ameaca || "Ponto de Atenção";
      this.fieldLevel.value = prefill?.nivel || "R3";
      this.fieldStatus.value = "Ativo";
    }
  }

  closeFormModal() {
    this.modalForm.classList.add("hidden");
  }

  openDisclaimer() { this.modalDisclaimer.classList.remove("hidden"); }
  closeDisclaimer() { this.modalDisclaimer.classList.add("hidden"); }

  focusLocation(lat, lng) {
    this.map.flyTo([lat, lng], 15);
  }
}