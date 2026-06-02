(function () {
  const STORAGE_KEY = "iot-map-admin-data-v1";
  const SEED_ENDPOINT = "./data/iot-map.json";

  const DEFAULT_FLOOR_PLAN = "./assets/image-2-floor-plan.svg";

  const placeFootprints = {
    library: "10% 16%, 72% 8%, 92% 31%, 82% 78%, 30% 92%, 8% 66%",
    "teaching-a": "18% 5%, 88% 14%, 82% 44%, 100% 54%, 78% 96%, 8% 82%, 14% 47%, 0 36%",
    "lab-center": "8% 22%, 42% 8%, 90% 12%, 100% 52%, 74% 92%, 22% 84%, 0 58%",
    "sports-field": "4% 34%, 18% 12%, 78% 8%, 96% 28%, 91% 72%, 68% 94%, 16% 82%, 0 58%",
    "east-gate": "22% 0, 76% 8%, 100% 34%, 82% 100%, 22% 92%, 0 54%"
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function uid(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  }

  async function loadSeed() {
    const response = await fetch(SEED_ENDPOINT, { cache: "no-store" });
    if (!response.ok) {
      throw new Error("mock seed api failed");
    }
    return normalizeData(await response.json());
  }

  async function getData() {
    const cached = localStorage.getItem(STORAGE_KEY);
    if (cached) {
      try {
        return normalizeData(JSON.parse(cached));
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    const seed = await loadSeed();
    saveData(seed);
    return seed;
  }

  function saveData(data) {
    const normalized = normalizeData(data);
    normalized.updatedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized, null, 2));
    return clone(normalized);
  }

  async function resetData() {
    localStorage.removeItem(STORAGE_KEY);
    const seed = await loadSeed();
    saveData(seed);
    return seed;
  }

  function normalizeData(data) {
    const next = clone(data);
    next.unit = {
      id: "nthu",
      name: "台湾 国立清华大学",
      campus: "校本部",
      address: "台湾新竹市东区光复路二段101号",
      center: { lng: 120.9967, lat: 24.7961 },
      mapProvider: "mock-amap-compatible",
      contact: "校园安全中心",
      contactPhone: "+886-3-571-5131",
      manager: "智慧校园运维组",
      status: "enabled",
      ...next.unit
    };
    next.unit.center = {
      lng: Number(next.unit.center?.lng ?? 120.9967),
      lat: Number(next.unit.center?.lat ?? 24.7961)
    };
    next.places = (next.places ?? []).map((place, index) => normalizePlace(place, index));
    next.updatedAt = next.updatedAt ?? new Date().toISOString();
    return next;
  }

  function normalizePlace(place, index) {
    const type = place.type === "outdoor" ? "outdoor" : "indoor";
    const normalized = {
      id: place.id || uid("place"),
      name: place.name || `场所 ${index + 1}`,
      type,
      category: type === "indoor" ? "室内场所" : "户外场所",
      buildingNo: place.buildingNo || `B${String(index + 1).padStart(2, "0")}`,
      manager: place.manager || "后勤运维组",
      area: Number(place.area ?? (type === "indoor" ? 5200 : 9600)),
      status: place.status || "enabled",
      position: normalizePosition(place.position),
      footprint: place.footprint || placeFootprints[place.id] || "8% 8%, 92% 12%, 88% 88%, 12% 92%",
      remarks: place.remarks || "",
      ...place
    };
    normalized.position = normalizePosition(normalized.position);
    normalized.category = normalized.type === "indoor" ? "室内场所" : "户外场所";
    if (normalized.type === "indoor") {
      normalized.floors = (normalized.floors ?? []).map((floor, floorIndex) => normalizeFloor(floor, normalized.id, floorIndex));
      delete normalized.devices;
    } else {
      normalized.devices = (normalized.devices ?? []).map((device) => normalizeDevice(device, normalized.id, null));
      delete normalized.floors;
    }
    return normalized;
  }

  function normalizePosition(position = {}) {
    return {
      x: clampNumber(position.x, 5, 92, 20),
      y: clampNumber(position.y, 5, 88, 20),
      w: clampNumber(position.w, 5, 40, 16),
      h: clampNumber(position.h, 5, 40, 16)
    };
  }

function normalizeFloor(floor, placeId, index) {
  return {
      ...floor,
      id: floor.id || uid("floor"),
      placeId,
      label: floor.label || `${index + 1}F`,
      name: floor.name || `${floor.label || `${index + 1}F`} 平面图`,
      sort: Number(floor.sort ?? index + 1),
      planUrl: floor.planUrl || DEFAULT_FLOOR_PLAN,
      area: Number(floor.area ?? 1200),
      status: floor.status || "enabled",
      devices: (floor.devices ?? []).map((device) => normalizeDevice(device, placeId, floor.id))
    };
  }

  function normalizeDevice(device, placeId, floorId) {
    return {
      ...device,
      id: device.id || uid("device"),
      name: device.name || "未命名设备",
      type: ["camera", "light", "access"].includes(device.type) ? device.type : "camera",
      status: ["normal", "abnormal"].includes(device.status) ? device.status : "normal",
      placeId,
      floorId,
      x: clampNumber(device.x, 0, 100, 50),
      y: clampNumber(device.y, 0, 100, 50),
      code: device.code || device.id || uid("code"),
      brand: device.brand || "Hikvision",
      model: device.model || "IoT-Standard",
      installDate: device.installDate || "2025-09-01",
      maintainer: device.maintainer || "校园安全中心",
      lastOnlineAt: device.lastOnlineAt || "2026-06-01 10:12:00",
      remarks: device.remarks || ""
    };
  }

  function clampNumber(value, min, max, fallback) {
    const number = Number(value);
    if (!Number.isFinite(number)) {
      return fallback;
    }
    return Math.min(max, Math.max(min, number));
  }

  async function updateUnit(payload) {
    const data = await getData();
    data.unit = {
      ...data.unit,
      ...payload,
      center: {
        lng: Number(payload.center?.lng ?? payload.lng ?? data.unit.center.lng),
        lat: Number(payload.center?.lat ?? payload.lat ?? data.unit.center.lat)
      }
    };
    return saveData(data);
  }

  async function createPlace(payload) {
    const data = await getData();
    const place = normalizePlace({
      id: payload.id || uid("place"),
      ...payload,
      floors: payload.type === "outdoor" ? undefined : [
        {
          id: uid("floor"),
          label: "1F",
          name: `${payload.name || "新场所"} 1F`,
          devices: []
        }
      ],
      devices: payload.type === "outdoor" ? [] : undefined
    }, data.places.length);
    data.places.push(place);
    return saveData(data);
  }

  async function updatePlace(placeId, payload) {
    const data = await getData();
    const index = data.places.findIndex((place) => place.id === placeId);
    if (index < 0) {
      throw new Error("place not found");
    }
    const current = data.places[index];
    const merged = { ...current, ...payload };
    if (current.type !== merged.type) {
      if (merged.type === "indoor") {
        merged.floors = [{ id: uid("floor"), label: "1F", name: `${merged.name} 1F`, devices: current.devices ?? [] }];
        delete merged.devices;
      } else {
        merged.devices = (current.floors ?? []).flatMap((floor) => floor.devices ?? []);
        delete merged.floors;
      }
    }
    data.places[index] = normalizePlace(merged, index);
    return saveData(data);
  }

  async function deletePlace(placeId) {
    const data = await getData();
    data.places = data.places.filter((place) => place.id !== placeId);
    return saveData(data);
  }

  async function createFloor(placeId, payload) {
    const data = await getData();
    const place = data.places.find((item) => item.id === placeId && item.type === "indoor");
    if (!place) {
      throw new Error("indoor place not found");
    }
    place.floors.push(normalizeFloor({ id: uid("floor"), devices: [], ...payload }, placeId, place.floors.length));
    return saveData(data);
  }

  async function updateFloor(placeId, floorId, payload) {
    const data = await getData();
    const floor = findFloor(data, placeId, floorId);
    Object.assign(floor, payload);
    return saveData(data);
  }

  async function deleteFloor(placeId, floorId) {
    const data = await getData();
    const place = data.places.find((item) => item.id === placeId && item.type === "indoor");
    if (!place) {
      throw new Error("indoor place not found");
    }
    place.floors = place.floors.filter((floor) => floor.id !== floorId);
    return saveData(data);
  }

  async function createDevice(payload) {
    const data = await getData();
    const place = data.places.find((item) => item.id === payload.placeId);
    if (!place) {
      throw new Error("place not found");
    }
    const device = normalizeDevice({ id: uid("device"), ...payload }, payload.placeId, payload.floorId || null);
    if (place.type === "outdoor") {
      place.devices.push(device);
    } else {
      const floor = findFloor(data, payload.placeId, payload.floorId);
      floor.devices.push(device);
    }
    return saveData(data);
  }

  async function updateDevice(deviceId, payload) {
    const data = await getData();
    const existing = findDeviceWithOwner(data, deviceId);
    if (!existing) {
      throw new Error("device not found");
    }
    existing.list.splice(existing.index, 1);
    const nextPayload = { ...existing.device, ...payload };
    await saveData(data);
    const latest = await getData();
    const targetPlace = latest.places.find((place) => place.id === nextPayload.placeId);
    if (!targetPlace) {
      throw new Error("target place not found");
    }
    const nextDevice = normalizeDevice(nextPayload, nextPayload.placeId, nextPayload.floorId || null);
    if (targetPlace.type === "outdoor") {
      nextDevice.floorId = null;
      targetPlace.devices.push(nextDevice);
    } else {
      const targetFloor = findFloor(latest, nextPayload.placeId, nextPayload.floorId);
      targetFloor.devices.push(nextDevice);
    }
    return saveData(latest);
  }

  async function deleteDevice(deviceId) {
    const data = await getData();
    const existing = findDeviceWithOwner(data, deviceId);
    if (!existing) {
      throw new Error("device not found");
    }
    existing.list.splice(existing.index, 1);
    return saveData(data);
  }

  function findFloor(data, placeId, floorId) {
    const place = data.places.find((item) => item.id === placeId && item.type === "indoor");
    const floor = place?.floors.find((item) => item.id === floorId);
    if (!floor) {
      throw new Error("floor not found");
    }
    return floor;
  }

  function findDeviceWithOwner(data, deviceId) {
    for (const place of data.places) {
      if (place.type === "outdoor") {
        const index = place.devices.findIndex((device) => device.id === deviceId);
        if (index >= 0) {
          return { place, floor: null, list: place.devices, index, device: place.devices[index] };
        }
      } else {
        for (const floor of place.floors) {
          const index = floor.devices.findIndex((device) => device.id === deviceId);
          if (index >= 0) {
            return { place, floor, list: floor.devices, index, device: floor.devices[index] };
          }
        }
      }
    }
    return null;
  }

  function getDeviceRows(data) {
    return data.places.flatMap((place) => {
      if (place.type === "outdoor") {
        return place.devices.map((device) => ({ ...device, placeName: place.name, floorLabel: "户外" }));
      }
      return place.floors.flatMap((floor) =>
        floor.devices.map((device) => ({ ...device, placeName: place.name, floorLabel: floor.label }))
      );
    });
  }

  window.IotMapApi = {
    getData,
    saveData,
    resetData,
    updateUnit,
    createPlace,
    updatePlace,
    deletePlace,
    createFloor,
    updateFloor,
    deleteFloor,
    createDevice,
    updateDevice,
    deleteDevice,
    getDeviceRows,
    meta: {
      storageKey: STORAGE_KEY,
      seedEndpoint: SEED_ENDPOINT,
      defaultFloorPlan: DEFAULT_FLOOR_PLAN
    }
  };
})();
