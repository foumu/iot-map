const API_ENDPOINT = "./data/iot-map.json";

const DEVICE_META = {
  camera: { label: "视频摄像头", icon: "video" },
  light: { label: "路灯", icon: "light" },
  access: { label: "门禁", icon: "access" }
};

const STATUS_META = {
  normal: { label: "正常", className: "is-normal" },
  abnormal: { label: "异常", className: "is-abnormal" }
};

const DEFAULT_VIEWPORT = { scale: 1, x: 0, y: 0 };

const PLACE_FOOTPRINTS = {
  library: "10% 16%, 72% 8%, 92% 31%, 82% 78%, 30% 92%, 8% 66%",
  "teaching-a": "18% 5%, 88% 14%, 82% 44%, 100% 54%, 78% 96%, 8% 82%, 14% 47%, 0 36%",
  "lab-center": "8% 22%, 42% 8%, 90% 12%, 100% 52%, 74% 92%, 22% 84%, 0 58%",
  "sports-field": "4% 34%, 18% 12%, 78% 8%, 96% 28%, 91% 72%, 68% 94%, 16% 82%, 0 58%",
  "east-gate": "22% 0, 76% 8%, 100% 34%, 82% 100%, 22% 92%, 0 54%"
};

const state = {
  data: null,
  view: "map",
  activePlaceId: null,
  activeFloorId: null,
  selectedDeviceId: null,
  transforms: new Map(),
  drag: null
};

const els = {
  stage: document.querySelector("#stage"),
  viewport: document.querySelector("#viewport"),
  scene: document.querySelector("#scene"),
  breadcrumbs: document.querySelector("#breadcrumbs"),
  scopeTitle: document.querySelector("#scope-title"),
  scopeList: document.querySelector("#scope-list"),
  floorSection: document.querySelector("#floor-section"),
  floorTitle: document.querySelector("#floor-title"),
  floorList: document.querySelector("#floor-list"),
  floorRail: document.querySelector("#floor-rail"),
  stageLabel: document.querySelector("#stage-label"),
  stageTitle: document.querySelector("#stage-title"),
  statusSummary: document.querySelector("#status-summary"),
  detailContent: document.querySelector("#detail-content"),
  zoomIn: document.querySelector("#zoom-in"),
  zoomOut: document.querySelector("#zoom-out"),
  resetView: document.querySelector("#reset-view")
};

fetch(API_ENDPOINT)
  .then((response) => {
    if (!response.ok) {
      throw new Error("mock api failed");
    }
    return response.json();
  })
  .then((data) => {
    state.data = data;
    state.activeFloorId = data.places.find((place) => place.type === "indoor")?.floors[0]?.id ?? null;
    bindEvents();
    render();
  })
  .catch(() => {
    els.scene.innerHTML = '<div class="load-error">模拟数据加载失败。</div>';
  });

function bindEvents() {
  els.viewport.addEventListener("wheel", handleWheel, { passive: false });
  els.viewport.addEventListener("pointerdown", handlePointerDown);
  window.addEventListener("pointermove", handlePointerMove);
  window.addEventListener("pointerup", handlePointerUp);

  els.zoomIn.addEventListener("click", () => zoomFromCenter(1.16));
  els.zoomOut.addEventListener("click", () => zoomFromCenter(0.86));
  els.resetView.addEventListener("click", () => {
    state.transforms.set(getTransformKey(), { ...DEFAULT_VIEWPORT });
    applyTransform();
  });

  els.scene.addEventListener("click", (event) => {
    const unitButton = event.target.closest("[data-unit]");
    const placeButton = event.target.closest("[data-place]");
    const deviceButton = event.target.closest("[data-device]");

    if (unitButton) {
      state.view = "unit";
      state.activePlaceId = null;
      state.selectedDeviceId = null;
      render();
      return;
    }

    if (placeButton) {
      openPlace(placeButton.dataset.place);
      return;
    }

    if (deviceButton) {
      state.selectedDeviceId = deviceButton.dataset.device;
      renderDetails();
    }
  });
}

function openPlace(placeId) {
  const place = getPlace(placeId);
  state.view = "place";
  state.activePlaceId = placeId;
  state.activeFloorId = place.type === "indoor" ? place.floors[0]?.id ?? null : null;
  state.selectedDeviceId = null;
  render();
}

function render() {
  renderBreadcrumbs();
  renderScope();
  renderStage();
  renderFloors();
  renderSummary();
  renderDetails();
  applyTransform();
}

function renderBreadcrumbs() {
  const unit = state.data.unit;
  const activePlace = getActivePlace();
  const activeFloor = getActiveFloor();
  const items = [
    { label: "单位地图", view: "map" },
    ...(state.view !== "map" ? [{ label: unit.name, view: "unit" }] : []),
    ...(activePlace ? [{ label: activePlace.name, view: "place" }] : []),
    ...(activeFloor ? [{ label: activeFloor.label, view: "floor" }] : [])
  ];

  els.breadcrumbs.innerHTML = items
    .map((item, index) => {
      const isLast = index === items.length - 1;
      return `
        <button class="crumb ${isLast ? "is-current" : ""}" data-crumb="${item.view}" type="button" ${isLast ? "aria-current='page'" : ""}>
          ${escapeHtml(item.label)}
        </button>
      `;
    })
    .join("");

  els.breadcrumbs.querySelectorAll("[data-crumb]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.crumb === "map") {
        state.view = "map";
        state.activePlaceId = null;
        state.activeFloorId = null;
        state.selectedDeviceId = null;
      }
      if (button.dataset.crumb === "unit") {
        state.view = "unit";
        state.activePlaceId = null;
        state.activeFloorId = null;
        state.selectedDeviceId = null;
      }
      render();
    });
  });
}

function renderScope() {
  const places = state.data.places;
  const activePlace = getActivePlace();
  els.scopeTitle.textContent =
    state.view === "map" ? state.data.unit.name : state.view === "unit" ? "场所列表" : activePlace.name;

  if (state.view === "map") {
    els.scopeList.innerHTML = renderUnitSummary();
    return;
  }

  els.scopeList.innerHTML = places
    .map((place) => {
      const counts = getPlaceDeviceStats(place);
      return `
        <button class="scope-item ${state.activePlaceId === place.id ? "is-active" : ""}" data-scope-place="${place.id}" type="button">
          <span>
            <strong>${escapeHtml(place.name)}</strong>
            <small>${place.category}</small>
          </span>
          <em>${counts.total}</em>
        </button>
      `;
    })
    .join("");

  els.scopeList.querySelectorAll("[data-scope-place]").forEach((button) => {
    button.addEventListener("click", () => openPlace(button.dataset.scopePlace));
  });
}

function renderUnitSummary() {
  const unit = state.data.unit;
  return `
    <div class="info-stack">
      <span>中心经度 <strong>${unit.center.lng.toFixed(4)}</strong></span>
      <span>中心纬度 <strong>${unit.center.lat.toFixed(4)}</strong></span>
      <span>模拟接口 <strong>${API_ENDPOINT}</strong></span>
    </div>
  `;
}

function renderStage() {
  if (state.view === "map") {
    renderMapView();
  } else if (state.view === "unit") {
    renderUnitPlanView();
  } else {
    renderPlaceView();
  }
}

function renderMapView() {
  const unit = state.data.unit;
  els.stageLabel.textContent = "单位地图";
  els.stageTitle.textContent = `${unit.name} ${unit.campus}`;
  els.scene.className = "scene map-scene";
  els.scene.innerHTML = `
    <div class="mock-map">
      <div class="map-road road-a"></div>
      <div class="map-road road-b"></div>
      <div class="map-road road-c"></div>
      <div class="map-river"></div>
      <div class="map-district district-a">新竹市</div>
      <div class="map-district district-b">光复路</div>
      <div class="map-coordinate">${unit.center.lng.toFixed(4)}, ${unit.center.lat.toFixed(4)}</div>
      <button class="unit-marker" data-unit="${unit.id}" type="button" style="left:50%;top:52%">
        <span class="pulse"></span>
        <strong>${escapeHtml(unit.name)}</strong>
        <small>${escapeHtml(unit.campus)}</small>
      </button>
    </div>
  `;
}

function renderUnitPlanView() {
  els.stageLabel.textContent = "单位平面图";
  els.stageTitle.textContent = `${state.data.unit.name} 场所总览`;
  els.scene.className = "scene plan-scene unit-plan";
  els.scene.innerHTML = `
    ${renderCampusPlanBase()}
    ${state.data.places.map(renderPlaceZone).join("")}
    ${state.data.places.filter((place) => place.type === "outdoor").flatMap((place) => place.devices.map((device) => renderDeviceMarker(device, place.id))).join("")}
  `;
}

function renderPlaceView() {
  const place = getActivePlace();
  const activeFloor = getActiveFloor();
  els.stageLabel.textContent = place.type === "indoor" ? "楼层平面图" : "户外场所平面图";
  els.stageTitle.textContent = place.type === "indoor" ? `${place.name} ${activeFloor.label}` : place.name;
  els.scene.className = `scene plan-scene ${place.type === "indoor" ? "floor-plan" : "outdoor-plan"}`;

  if (place.type === "indoor") {
    els.scene.innerHTML = `
      ${renderIndoorPlanBase(place, activeFloor)}
      ${activeFloor.devices.map((device) => renderDeviceMarker(device, place.id)).join("")}
    `;
    return;
  }

  els.scene.innerHTML = `
    ${renderOutdoorPlanBase(place)}
    ${place.devices.map((device) => renderDeviceMarker(device, place.id)).join("")}
  `;
}

function renderCampusPlanBase() {
  return `
    <div class="campus-ground">
      <div class="campus-road horizontal"></div>
      <div class="campus-road vertical"></div>
      <div class="campus-water"></div>
      <div class="campus-green green-a"></div>
      <div class="campus-green green-b"></div>
      <div class="campus-label north">北区生活带</div>
      <div class="campus-label south">教学科研带</div>
    </div>
  `;
}

function renderPlaceZone(place) {
  const pos = place.position;
  const footprint = PLACE_FOOTPRINTS[place.id] ?? "8% 8%, 92% 12%, 88% 88%, 12% 92%";
  return `
    <button
      class="place-zone ${place.type}"
      data-place="${place.id}"
      type="button"
      aria-label="${escapeHtml(place.name)} ${place.category}"
      style="left:${pos.x}%;top:${pos.y}%;width:${pos.w}%;height:${pos.h}%;--footprint: polygon(${footprint})"
    >
      <span class="place-footprint" aria-hidden="true"></span>
      <span class="place-label">
        <strong>${escapeHtml(place.name)}</strong>
        <small>${place.category}</small>
      </span>
    </button>
  `;
}

function renderIndoorPlanBase(place, floor) {
  const wingClass = place.id === "library" ? "library-layout" : place.id === "teaching-a" ? "teaching-layout" : "lab-layout";
  return `
    <div class="floor-ground ${wingClass}">
      <img class="floor-plan-image" src="./assets/image-2-floor-plan.svg" alt="${escapeHtml(place.name)} ${escapeHtml(floor.label)} 平面图" />
    </div>
  `;
}

function renderOutdoorPlanBase(place) {
  const isGate = place.id === "east-gate";
  return `
    <div class="outdoor-ground ${isGate ? "gate-layout" : "field-layout"}">
      <div class="outdoor-track"></div>
      <div class="outdoor-path path-a"></div>
      <div class="outdoor-path path-b"></div>
      <div class="outdoor-label">${escapeHtml(place.name)}</div>
    </div>
  `;
}

function renderDeviceMarker(device, placeId) {
  const meta = DEVICE_META[device.type];
  const status = STATUS_META[device.status];
  return `
    <button
      class="device-marker ${status.className} ${state.selectedDeviceId === device.id ? "is-selected" : ""}"
      data-device="${device.id}"
      data-place-owner="${placeId}"
      type="button"
      style="left:${device.x}%;top:${device.y}%"
      aria-label="${escapeHtml(device.name)} ${status.label}"
      title="${escapeHtml(device.name)} ${status.label}"
    >
      ${renderDeviceIcon(meta.icon)}
    </button>
  `;
}

function renderDeviceIcon(icon) {
  const icons = {
    video: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H4zM16 10l4-2v8l-4-2" /></svg>',
    light: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18h6M10 22h4M8 10a4 4 0 1 1 8 0c0 2-1.5 3-2 5h-4c-.5-2-2-3-2-5Z" /></svg>',
    access: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 11V8a5 5 0 0 1 10 0v3M6 11h12v10H6zM12 15v2" /></svg>'
  };
  return icons[icon];
}

function renderFloors() {
  const place = getActivePlace();
  const showFloors = state.view === "place" && place?.type === "indoor";
  els.floorSection.classList.toggle("is-hidden", !showFloors);
  els.floorRail.classList.toggle("is-hidden", !showFloors);

  if (!showFloors) {
    els.floorList.innerHTML = "";
    els.floorRail.innerHTML = "";
    return;
  }

  els.floorTitle.textContent = place.name;
  const html = place.floors
    .map(
      (floor) => `
        <button class="floor-button ${state.activeFloorId === floor.id ? "is-active" : ""}" data-floor="${floor.id}" type="button">
          ${escapeHtml(floor.label)}
        </button>
      `
    )
    .join("");
  els.floorList.innerHTML = html;
  els.floorRail.innerHTML = html;

  document.querySelectorAll("[data-floor]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeFloorId = button.dataset.floor;
      state.selectedDeviceId = null;
      render();
    });
  });
}

function renderSummary() {
  const devices = getVisibleDevices();
  const normal = devices.filter((device) => device.status === "normal").length;
  const abnormal = devices.filter((device) => device.status === "abnormal").length;
  els.statusSummary.innerHTML = `
    <span><b>${devices.length}</b> 设备</span>
    <span class="normal"><b>${normal}</b> 正常</span>
    <span class="abnormal"><b>${abnormal}</b> 异常</span>
  `;
}

function renderDetails() {
  const activePlace = getActivePlace();
  const activeFloor = getActiveFloor();
  const selectedDevice = findDevice(state.selectedDeviceId);

  if (selectedDevice) {
    const owner = findDeviceOwner(selectedDevice.id);
    els.detailContent.innerHTML = `
      <article class="detail-block">
        <h2>${escapeHtml(selectedDevice.name)}</h2>
        <dl>
          <div><dt>类型</dt><dd>${DEVICE_META[selectedDevice.type].label}</dd></div>
          <div><dt>状态</dt><dd class="${selectedDevice.status === "normal" ? "text-normal" : "text-abnormal"}">${STATUS_META[selectedDevice.status].label}</dd></div>
          <div><dt>位置</dt><dd>${escapeHtml(owner.place.name)}${owner.floor ? ` / ${escapeHtml(owner.floor.label)}` : ""}</dd></div>
          <div><dt>编号</dt><dd>${escapeHtml(selectedDevice.id)}</dd></div>
        </dl>
      </article>
    `;
    return;
  }

  const devices = getVisibleDevices();
  const typeStats = Object.entries(DEVICE_META)
    .map(([type, meta]) => {
      const count = devices.filter((device) => device.type === type).length;
      return `<span>${meta.label}<strong>${count}</strong></span>`;
    })
    .join("");

  els.detailContent.innerHTML = `
    <article class="detail-block">
      <h2>${escapeHtml(getDetailTitle(activePlace, activeFloor))}</h2>
      <dl>
        <div><dt>当前层级</dt><dd>${getLayerLabel()}</dd></div>
        <div><dt>设备总数</dt><dd>${devices.length}</dd></div>
        <div><dt>异常设备</dt><dd class="text-abnormal">${devices.filter((device) => device.status === "abnormal").length}</dd></div>
      </dl>
      <div class="type-stats">${typeStats}</div>
    </article>
  `;
}

function handleWheel(event) {
  event.preventDefault();
  const rect = els.viewport.getBoundingClientRect();
  const current = getTransform();
  const factor = event.deltaY > 0 ? 0.9 : 1.1;
  const nextScale = clamp(current.scale * factor, 0.62, 3.4);
  const pointerX = event.clientX - rect.left;
  const pointerY = event.clientY - rect.top;
  const worldX = (pointerX - current.x) / current.scale;
  const worldY = (pointerY - current.y) / current.scale;

  setTransform({
    scale: nextScale,
    x: pointerX - worldX * nextScale,
    y: pointerY - worldY * nextScale
  });
}

function handlePointerDown(event) {
  if (event.button !== 0) {
    return;
  }
  if (event.target.closest("button")) {
    return;
  }
  els.viewport.setPointerCapture(event.pointerId);
  const transform = getTransform();
  state.drag = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    originX: transform.x,
    originY: transform.y
  };
  els.viewport.classList.add("is-dragging");
}

function handlePointerMove(event) {
  if (!state.drag || state.drag.pointerId !== event.pointerId) {
    return;
  }
  setTransform({
    ...getTransform(),
    x: state.drag.originX + event.clientX - state.drag.startX,
    y: state.drag.originY + event.clientY - state.drag.startY
  });
}

function handlePointerUp(event) {
  if (!state.drag || state.drag.pointerId !== event.pointerId) {
    return;
  }
  state.drag = null;
  els.viewport.classList.remove("is-dragging");
}

function zoomFromCenter(factor) {
  const rect = els.viewport.getBoundingClientRect();
  const current = getTransform();
  const nextScale = clamp(current.scale * factor, 0.62, 3.4);
  const pointerX = rect.width / 2;
  const pointerY = rect.height / 2;
  const worldX = (pointerX - current.x) / current.scale;
  const worldY = (pointerY - current.y) / current.scale;

  setTransform({
    scale: nextScale,
    x: pointerX - worldX * nextScale,
    y: pointerY - worldY * nextScale
  });
}

function getTransformKey() {
  if (state.view === "place") {
    return `place:${state.activePlaceId}:${state.activeFloorId ?? "outdoor"}`;
  }
  return state.view;
}

function getTransform() {
  const key = getTransformKey();
  if (!state.transforms.has(key)) {
    state.transforms.set(key, { ...DEFAULT_VIEWPORT });
  }
  return state.transforms.get(key);
}

function setTransform(transform) {
  state.transforms.set(getTransformKey(), transform);
  applyTransform();
}

function applyTransform() {
  const transform = getTransform();
  els.scene.style.transform = `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`;
}

function getActivePlace() {
  return state.activePlaceId ? getPlace(state.activePlaceId) : null;
}

function getActiveFloor() {
  const place = getActivePlace();
  if (!place || place.type !== "indoor") {
    return null;
  }
  return place.floors.find((floor) => floor.id === state.activeFloorId) ?? place.floors[0];
}

function getPlace(placeId) {
  return state.data.places.find((place) => place.id === placeId);
}

function getVisibleDevices() {
  if (state.view === "map") {
    return getAllDevices();
  }
  if (state.view === "unit") {
    return state.data.places.filter((place) => place.type === "outdoor").flatMap((place) => place.devices);
  }
  const place = getActivePlace();
  if (place.type === "outdoor") {
    return place.devices;
  }
  return getActiveFloor()?.devices ?? [];
}

function getAllDevices() {
  return state.data.places.flatMap((place) =>
    place.type === "outdoor" ? place.devices : place.floors.flatMap((floor) => floor.devices)
  );
}

function getPlaceDeviceStats(place) {
  const devices = place.type === "outdoor" ? place.devices : place.floors.flatMap((floor) => floor.devices);
  return {
    total: devices.length,
    abnormal: devices.filter((device) => device.status === "abnormal").length
  };
}

function findDevice(deviceId) {
  if (!deviceId) {
    return null;
  }
  return getAllDevices().find((device) => device.id === deviceId) ?? null;
}

function findDeviceOwner(deviceId) {
  for (const place of state.data.places) {
    if (place.type === "outdoor") {
      const device = place.devices.find((item) => item.id === deviceId);
      if (device) {
        return { place, floor: null };
      }
    } else {
      for (const floor of place.floors) {
        const device = floor.devices.find((item) => item.id === deviceId);
        if (device) {
          return { place, floor };
        }
      }
    }
  }
  return { place: getActivePlace(), floor: getActiveFloor() };
}

function getDetailTitle(place, floor) {
  if (state.view === "map") {
    return `${state.data.unit.name} 总览`;
  }
  if (state.view === "unit") {
    return "单位平面图";
  }
  return floor ? `${place.name} ${floor.label}` : place.name;
}

function getLayerLabel() {
  if (state.view === "map") {
    return "单位地图";
  }
  if (state.view === "unit") {
    return "单位平面图";
  }
  const place = getActivePlace();
  const floor = getActiveFloor();
  return floor ? `${place.name} / ${floor.label}` : `${place.name} / 户外`;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
