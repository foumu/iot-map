const DEVICE_META = {
  camera: "视频摄像头",
  light: "路灯",
  access: "门禁"
};

const STATUS_META = {
  normal: "正常",
  abnormal: "异常"
};

const state = {
  data: null,
  module: "dashboard",
  selectedPlaceId: null,
  deviceFilters: {
    keyword: "",
    placeId: "",
    type: "",
    status: ""
  }
};

const els = {
  title: document.querySelector("#page-title"),
  content: document.querySelector("#admin-content"),
  menu: document.querySelector(".admin-menu"),
  refresh: document.querySelector("#refresh-data"),
  dialog: document.querySelector("#entity-dialog"),
  form: document.querySelector("#entity-form"),
  dialogTitle: document.querySelector("#dialog-title"),
  dialogBody: document.querySelector("#dialog-body")
};

init();

async function init() {
  await reloadData();
  bindShell();
  render();
}

function bindShell() {
  els.menu.addEventListener("click", (event) => {
    const button = event.target.closest("[data-module]");
    if (!button) {
      return;
    }
    state.module = button.dataset.module;
    document.querySelectorAll("[data-module]").forEach((item) => item.classList.toggle("is-active", item === button));
    render();
  });

  els.refresh.addEventListener("click", async () => {
    await reloadData();
    render();
  });
}

async function reloadData() {
  state.data = await window.IotMapApi.getData();
  if (!state.selectedPlaceId || !state.data.places.some((place) => place.id === state.selectedPlaceId)) {
    state.selectedPlaceId = state.data.places[0]?.id ?? null;
  }
}

function render() {
  const titles = {
    dashboard: "工作台",
    unit: "单位信息管理",
    places: "场所和楼层管理",
    devices: "设备管理",
    data: "数据源管理"
  };
  els.title.textContent = titles[state.module];
  if (state.module === "dashboard") renderDashboard();
  if (state.module === "unit") renderUnit();
  if (state.module === "places") renderPlaces();
  if (state.module === "devices") renderDevices();
  if (state.module === "data") renderDataSource();
}

function renderDashboard() {
  const rows = getDeviceRows();
  const indoor = state.data.places.filter((place) => place.type === "indoor").length;
  const outdoor = state.data.places.filter((place) => place.type === "outdoor").length;
  const abnormal = rows.filter((device) => device.status === "abnormal").length;
  els.content.innerHTML = `
    <section class="stats-grid">
      ${statCard("场所总数", state.data.places.length)}
      ${statCard("室内场所", indoor)}
      ${statCard("户外场所", outdoor)}
      ${statCard("异常设备", abnormal, "danger")}
    </section>
    <section class="panel">
      <div class="panel-head">
        <div>
          <h2>数据闭环说明</h2>
          <p>管理端通过 mock API 写入 localStorage，展示页通过同一 API 读取数据。</p>
        </div>
        <a class="ghost-link" href="./index.html">打开展示页</a>
      </div>
      <table class="data-table">
        <thead><tr><th>模块</th><th>数据来源</th><th>前端使用方式</th></tr></thead>
        <tbody>
          <tr><td>单位信息</td><td>unit</td><td>地图中心点、单位名称、详情信息</td></tr>
          <tr><td>场所和楼层</td><td>places / floors</td><td>单位平面图、场所切换、楼层切换</td></tr>
          <tr><td>设备</td><td>devices</td><td>摄像头、路灯、门禁点位和状态展示</td></tr>
        </tbody>
      </table>
    </section>
    <section class="panel">
      <div class="panel-head">
        <div>
          <h2>最近设备</h2>
          <p>展示前 8 条设备记录，完整数据可在设备管理中维护。</p>
        </div>
      </div>
      ${renderDeviceTable(rows.slice(0, 8), false)}
    </section>
  `;
}

function renderUnit() {
  const unit = state.data.unit;
  els.content.innerHTML = `
    <section class="panel">
      <div class="panel-head">
        <div>
          <h2>${escapeHtml(unit.name)}</h2>
          <p>维护单位中心坐标、联系人、校区和地图提供方。</p>
        </div>
      </div>
      <form class="form-grid" id="unit-form">
        ${field("单位名称", "name", unit.name)}
        ${field("校区名称", "campus", unit.campus)}
        ${field("详细地址", "address", unit.address, "full")}
        ${field("中心经度", "lng", unit.center.lng)}
        ${field("中心纬度", "lat", unit.center.lat)}
        ${field("地图类型", "mapProvider", unit.mapProvider)}
        ${field("负责部门", "manager", unit.manager)}
        ${field("联系人", "contact", unit.contact)}
        ${field("联系电话", "contactPhone", unit.contactPhone)}
        <div class="field">
          <label>状态</label>
          <select name="status">${option("enabled", "启用", unit.status)}${option("disabled", "停用", unit.status)}</select>
        </div>
        <div class="field full"><button class="primary-button" type="submit">保存单位信息</button></div>
      </form>
    </section>
  `;
  document.querySelector("#unit-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await window.IotMapApi.updateUnit({
      name: form.get("name"),
      campus: form.get("campus"),
      address: form.get("address"),
      mapProvider: form.get("mapProvider"),
      manager: form.get("manager"),
      contact: form.get("contact"),
      contactPhone: form.get("contactPhone"),
      status: form.get("status"),
      center: {
        lng: form.get("lng"),
        lat: form.get("lat")
      }
    });
    await reloadData();
    render();
  });
}

function renderPlaces() {
  const selected = getSelectedPlace();
  els.content.innerHTML = `
    <div class="split-grid">
      <section class="panel">
        <div class="panel-head">
          <div>
            <h2>场所列表</h2>
            <p>维护单位平面图上的场所、轮廓和区域属性。</p>
          </div>
          <button class="primary-button" id="add-place" type="button">新增场所</button>
        </div>
        ${renderPlaceTable()}
      </section>
      <section class="panel">
        <div class="panel-head">
          <div>
            <h2>楼层管理</h2>
            <p>${selected ? escapeHtml(selected.name) : "请选择室内场所"}</p>
          </div>
          ${selected?.type === "indoor" ? '<button class="primary-button" id="add-floor" type="button">新增楼层</button>' : ""}
        </div>
        ${renderFloorTable(selected)}
      </section>
    </div>
  `;
  bindPlaceEvents();
}

function renderDevices() {
  const rows = getFilteredDeviceRows();
  els.content.innerHTML = `
    <section class="panel">
      <div class="panel-head">
        <div>
          <h2>设备列表</h2>
          <p>维护摄像头、路灯、门禁的所属场所、楼层、坐标和运行状态。</p>
        </div>
        <button class="primary-button" id="add-device" type="button">新增设备</button>
      </div>
      <form class="query-form" id="device-filter-form">
        <div class="field"><label>关键词</label><input name="keyword" value="${escapeAttr(state.deviceFilters.keyword)}" placeholder="设备名称 / 编号" /></div>
        <div class="field"><label>场所</label><select name="placeId">${option("", "全部场所", state.deviceFilters.placeId)}${state.data.places.map((place) => option(place.id, place.name, state.deviceFilters.placeId)).join("")}</select></div>
        <div class="field"><label>类型</label><select name="type">${option("", "全部类型", state.deviceFilters.type)}${Object.entries(DEVICE_META).map(([value, label]) => option(value, label, state.deviceFilters.type)).join("")}</select></div>
        <div class="field"><label>状态</label><select name="status">${option("", "全部状态", state.deviceFilters.status)}${option("normal", "正常", state.deviceFilters.status)}${option("abnormal", "异常", state.deviceFilters.status)}</select></div>
        <button class="ghost-button" type="submit">查询</button>
      </form>
    </section>
    <section class="panel">${renderDeviceTable(rows, true)}</section>
  `;
  document.querySelector("#device-filter-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    state.deviceFilters = {
      keyword: form.get("keyword").trim(),
      placeId: form.get("placeId"),
      type: form.get("type"),
      status: form.get("status")
    };
    renderDevices();
  });
  document.querySelector("#add-device").addEventListener("click", () => openDeviceDialog());
  document.querySelectorAll("[data-edit-device]").forEach((button) => {
    button.addEventListener("click", () => openDeviceDialog(button.dataset.editDevice));
  });
  document.querySelectorAll("[data-delete-device]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (confirm("确认删除该设备吗？")) {
        await window.IotMapApi.deleteDevice(button.dataset.deleteDevice);
        await reloadData();
        renderDevices();
      }
    });
  });
}

function renderDataSource() {
  els.content.innerHTML = `
    <section class="panel">
      <div class="panel-head">
        <div>
          <h2>模拟 API 数据</h2>
          <p>当前数据保存在浏览器 localStorage：${window.IotMapApi.meta.storageKey}</p>
        </div>
        <div class="toolbar">
          <button class="ghost-button" id="export-json" type="button">导出 JSON</button>
          <button class="danger-button" id="reset-json" type="button">恢复初始数据</button>
        </div>
      </div>
      <textarea class="json-box" id="json-editor">${escapeHtml(JSON.stringify(state.data, null, 2))}</textarea>
      <div class="toolbar" style="margin-top: 12px">
        <button class="primary-button" id="save-json" type="button">保存 JSON</button>
      </div>
    </section>
  `;
  document.querySelector("#save-json").addEventListener("click", async () => {
    try {
      const next = JSON.parse(document.querySelector("#json-editor").value);
      window.IotMapApi.saveData(next);
      await reloadData();
      renderDataSource();
    } catch (error) {
      alert(`JSON 格式错误：${error.message}`);
    }
  });
  document.querySelector("#export-json").addEventListener("click", () => {
    navigator.clipboard?.writeText(JSON.stringify(state.data, null, 2));
    alert("JSON 已复制到剪贴板。");
  });
  document.querySelector("#reset-json").addEventListener("click", async () => {
    if (confirm("确认恢复初始 JSON 数据吗？当前浏览器本地改动会被清除。")) {
      await window.IotMapApi.resetData();
      await reloadData();
      renderDataSource();
    }
  });
}

function renderPlaceTable() {
  return `
    <table class="data-table">
      <thead><tr><th>场所名称</th><th>类型</th><th>面积</th><th>状态</th><th>设备</th><th>操作</th></tr></thead>
      <tbody>
        ${state.data.places.map((place) => {
          const count = getPlaceDevices(place).length;
          return `
            <tr class="${state.selectedPlaceId === place.id ? "is-selected" : ""}">
              <td><button class="link-button" data-select-place="${place.id}" type="button">${escapeHtml(place.name)}</button></td>
              <td>${badge(place.type === "indoor" ? "室内" : "户外", place.type === "indoor" ? "blue" : "green")}</td>
              <td>${place.area} m²</td>
              <td>${badge(place.status === "enabled" ? "启用" : "停用", place.status === "enabled" ? "green" : "gray")}</td>
              <td>${count}</td>
              <td class="table-actions">
                <button class="link-button" data-edit-place="${place.id}" type="button">编辑</button>
                <button class="danger-button" data-delete-place="${place.id}" type="button">删除</button>
              </td>
            </tr>
          `;
        }).join("")}
      </tbody>
    </table>
  `;
}

function renderFloorTable(place) {
  if (!place) {
    return '<div class="empty">暂无场所数据。</div>';
  }
  if (place.type !== "indoor") {
    return '<div class="empty">户外场所不划分楼层，设备直接标注在场所平面图中。</div>';
  }
  if (!place.floors.length) {
    return '<div class="empty">当前室内场所还没有楼层。</div>';
  }
  return `
    <table class="data-table">
      <thead><tr><th>楼层</th><th>名称</th><th>面积</th><th>设备</th><th>操作</th></tr></thead>
      <tbody>
        ${place.floors.map((floor) => `
          <tr>
            <td>${escapeHtml(floor.label)}</td>
            <td>${escapeHtml(floor.name)}</td>
            <td>${floor.area} m²</td>
            <td>${floor.devices.length}</td>
            <td class="table-actions">
              <button class="link-button" data-edit-floor="${floor.id}" type="button">编辑</button>
              <button class="danger-button" data-delete-floor="${floor.id}" type="button">删除</button>
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function renderDeviceTable(rows, withActions) {
  if (!rows.length) {
    return '<div class="empty">暂无设备数据。</div>';
  }
  return `
    <table class="data-table">
      <thead><tr><th>设备名称</th><th>类型</th><th>状态</th><th>场所</th><th>楼层</th><th>坐标</th>${withActions ? "<th>操作</th>" : ""}</tr></thead>
      <tbody>
        ${rows.map((device) => `
          <tr>
            <td>${escapeHtml(device.name)}<br><small>${escapeHtml(device.code || device.id)}</small></td>
            <td>${DEVICE_META[device.type]}</td>
            <td>${badge(STATUS_META[device.status], device.status === "normal" ? "green" : "red")}</td>
            <td>${escapeHtml(device.placeName)}</td>
            <td>${escapeHtml(device.floorLabel)}</td>
            <td>${device.x}, ${device.y}</td>
            ${withActions ? `
              <td class="table-actions">
                <button class="link-button" data-edit-device="${device.id}" type="button">编辑</button>
                <button class="danger-button" data-delete-device="${device.id}" type="button">删除</button>
              </td>
            ` : ""}
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function bindPlaceEvents() {
  document.querySelector("#add-place").addEventListener("click", () => openPlaceDialog());
  document.querySelectorAll("[data-select-place]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedPlaceId = button.dataset.selectPlace;
      renderPlaces();
    });
  });
  document.querySelectorAll("[data-edit-place]").forEach((button) => {
    button.addEventListener("click", () => openPlaceDialog(button.dataset.editPlace));
  });
  document.querySelectorAll("[data-delete-place]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (confirm("确认删除该场所及其楼层、设备吗？")) {
        await window.IotMapApi.deletePlace(button.dataset.deletePlace);
        await reloadData();
        renderPlaces();
      }
    });
  });
  const addFloor = document.querySelector("#add-floor");
  addFloor?.addEventListener("click", () => openFloorDialog());
  document.querySelectorAll("[data-edit-floor]").forEach((button) => {
    button.addEventListener("click", () => openFloorDialog(button.dataset.editFloor));
  });
  document.querySelectorAll("[data-delete-floor]").forEach((button) => {
    button.addEventListener("click", async () => {
      const place = getSelectedPlace();
      if (confirm("确认删除该楼层及楼层设备吗？")) {
        await window.IotMapApi.deleteFloor(place.id, button.dataset.deleteFloor);
        await reloadData();
        renderPlaces();
      }
    });
  });
}

function openPlaceDialog(placeId) {
  const place = state.data.places.find((item) => item.id === placeId);
  els.dialogTitle.textContent = place ? "编辑场所" : "新增场所";
  els.dialogBody.innerHTML = `
    <div class="form-grid">
      ${field("场所名称", "name", place?.name ?? "")}
      <div class="field"><label>场所类型</label><select name="type">${option("indoor", "室内场所", place?.type)}${option("outdoor", "户外场所", place?.type)}</select></div>
      ${field("建筑编号", "buildingNo", place?.buildingNo ?? "")}
      ${field("负责部门", "manager", place?.manager ?? "")}
      ${field("面积 m²", "area", place?.area ?? 3200)}
      <div class="field"><label>状态</label><select name="status">${option("enabled", "启用", place?.status)}${option("disabled", "停用", place?.status)}</select></div>
      ${field("X", "x", place?.position.x ?? 22)}
      ${field("Y", "y", place?.position.y ?? 24)}
      ${field("宽度", "w", place?.position.w ?? 16)}
      ${field("高度", "h", place?.position.h ?? 16)}
      ${field("场所轮廓 polygon", "footprint", place?.footprint ?? "", "full")}
      ${textarea("备注", "remarks", place?.remarks ?? "")}
    </div>
  `;
  openDialog(async (form) => {
    const payload = {
      name: form.get("name"),
      type: form.get("type"),
      buildingNo: form.get("buildingNo"),
      manager: form.get("manager"),
      area: Number(form.get("area")),
      status: form.get("status"),
      position: {
        x: Number(form.get("x")),
        y: Number(form.get("y")),
        w: Number(form.get("w")),
        h: Number(form.get("h"))
      },
      footprint: form.get("footprint"),
      remarks: form.get("remarks")
    };
    if (place) {
      await window.IotMapApi.updatePlace(place.id, payload);
    } else {
      await window.IotMapApi.createPlace(payload);
    }
    await reloadData();
    renderPlaces();
  });
}

function openFloorDialog(floorId) {
  const place = getSelectedPlace();
  const floor = place?.floors?.find((item) => item.id === floorId);
  els.dialogTitle.textContent = floor ? "编辑楼层" : "新增楼层";
  els.dialogBody.innerHTML = `
    <div class="form-grid">
      ${field("楼层标识", "label", floor?.label ?? "1F")}
      ${field("楼层名称", "name", floor?.name ?? `${place.name} 1F`)}
      ${field("排序", "sort", floor?.sort ?? (place.floors.length + 1))}
      ${field("面积 m²", "area", floor?.area ?? 1200)}
      ${field("平面图 URL", "planUrl", floor?.planUrl ?? window.IotMapApi.meta.defaultFloorPlan, "full")}
      <div class="field"><label>状态</label><select name="status">${option("enabled", "启用", floor?.status)}${option("disabled", "停用", floor?.status)}</select></div>
    </div>
  `;
  openDialog(async (form) => {
    const payload = {
      label: form.get("label"),
      name: form.get("name"),
      sort: Number(form.get("sort")),
      area: Number(form.get("area")),
      planUrl: form.get("planUrl"),
      status: form.get("status")
    };
    if (floor) {
      await window.IotMapApi.updateFloor(place.id, floor.id, payload);
    } else {
      await window.IotMapApi.createFloor(place.id, payload);
    }
    await reloadData();
    renderPlaces();
  });
}

function openDeviceDialog(deviceId) {
  const device = getDeviceRows().find((item) => item.id === deviceId);
  const selectedPlace = state.data.places.find((place) => place.id === (device?.placeId || state.selectedPlaceId)) ?? state.data.places[0];
  els.dialogTitle.textContent = device ? "编辑设备" : "新增设备";
  els.dialogBody.innerHTML = `
    <div class="form-grid">
      ${field("设备名称", "name", device?.name ?? "")}
      ${field("设备编号", "code", device?.code ?? "")}
      <div class="field"><label>设备类型</label><select name="type">${Object.entries(DEVICE_META).map(([value, label]) => option(value, label, device?.type)).join("")}</select></div>
      <div class="field"><label>设备状态</label><select name="status">${option("normal", "正常", device?.status)}${option("abnormal", "异常", device?.status)}</select></div>
      <div class="field"><label>所属场所</label><select name="placeId" id="device-place">${state.data.places.map((place) => option(place.id, place.name, selectedPlace?.id)).join("")}</select></div>
      <div class="field"><label>所属楼层</label><select name="floorId" id="device-floor">${renderFloorOptions(selectedPlace, device?.floorId)}</select></div>
      ${field("X 坐标", "x", device?.x ?? 50)}
      ${field("Y 坐标", "y", device?.y ?? 50)}
      ${field("品牌", "brand", device?.brand ?? "Hikvision")}
      ${field("型号", "model", device?.model ?? "IoT-Standard")}
      ${field("安装日期", "installDate", device?.installDate ?? "2025-09-01")}
      ${field("维护人", "maintainer", device?.maintainer ?? "校园安全中心")}
      ${field("最后在线", "lastOnlineAt", device?.lastOnlineAt ?? "2026-06-01 10:12:00")}
      ${textarea("备注", "remarks", device?.remarks ?? "")}
    </div>
  `;
  const placeSelect = document.querySelector("#device-place");
  const floorSelect = document.querySelector("#device-floor");
  placeSelect.addEventListener("change", () => {
    const place = state.data.places.find((item) => item.id === placeSelect.value);
    floorSelect.innerHTML = renderFloorOptions(place, "");
  });
  openDialog(async (form) => {
    const place = state.data.places.find((item) => item.id === form.get("placeId"));
    const payload = {
      name: form.get("name"),
      code: form.get("code"),
      type: form.get("type"),
      status: form.get("status"),
      placeId: form.get("placeId"),
      floorId: place.type === "indoor" ? form.get("floorId") : null,
      x: Number(form.get("x")),
      y: Number(form.get("y")),
      brand: form.get("brand"),
      model: form.get("model"),
      installDate: form.get("installDate"),
      maintainer: form.get("maintainer"),
      lastOnlineAt: form.get("lastOnlineAt"),
      remarks: form.get("remarks")
    };
    if (device) {
      await window.IotMapApi.updateDevice(device.id, payload);
    } else {
      await window.IotMapApi.createDevice(payload);
    }
    await reloadData();
    renderDevices();
  });
}

function openDialog(onSave) {
  els.dialog.showModal();
  els.form.onsubmit = async (event) => {
    event.preventDefault();
    if (event.submitter?.value === "cancel") {
      els.dialog.close();
      return;
    }
    await onSave(new FormData(els.form));
    els.dialog.close();
  };
}

function renderFloorOptions(place, selected) {
  if (!place || place.type === "outdoor") {
    return option("", "户外场所", "");
  }
  return place.floors.map((floor) => option(floor.id, floor.label, selected || place.floors[0]?.id)).join("");
}

function statCard(label, value, className = "") {
  return `<article class="stat-card ${className}"><span>${label}</span><strong>${value}</strong></article>`;
}

function field(label, name, value, className = "") {
  return `<div class="field ${className}"><label>${label}</label><input name="${name}" value="${escapeAttr(value ?? "")}" /></div>`;
}

function textarea(label, name, value) {
  return `<div class="field full"><label>${label}</label><textarea name="${name}">${escapeHtml(value ?? "")}</textarea></div>`;
}

function option(value, label, selected) {
  return `<option value="${escapeAttr(value)}" ${String(value) === String(selected ?? "") ? "selected" : ""}>${escapeHtml(label)}</option>`;
}

function badge(label, color) {
  return `<span class="badge ${color}">${escapeHtml(label)}</span>`;
}

function getSelectedPlace() {
  return state.data.places.find((place) => place.id === state.selectedPlaceId) ?? null;
}

function getPlaceDevices(place) {
  return place.type === "outdoor" ? place.devices : place.floors.flatMap((floor) => floor.devices);
}

function getDeviceRows() {
  return window.IotMapApi.getDeviceRows(state.data);
}

function getFilteredDeviceRows() {
  const keyword = state.deviceFilters.keyword.toLowerCase();
  return getDeviceRows().filter((device) => {
    const text = `${device.name} ${device.code} ${device.placeName}`.toLowerCase();
    return (
      (!keyword || text.includes(keyword)) &&
      (!state.deviceFilters.placeId || device.placeId === state.deviceFilters.placeId) &&
      (!state.deviceFilters.type || device.type === state.deviceFilters.type) &&
      (!state.deviceFilters.status || device.status === state.deviceFilters.status)
    );
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("\n", " ");
}
