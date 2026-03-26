import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import './style.css'

const app = document.querySelector('#app')
const assetUrl = (path) => `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`
const avatarUrl = (seed) =>
  ({
    'Jardson Magalhaes': assetUrl('images/fotoperfilhomem.png'),
    'Jennifer Sousa': assetUrl('images/fotoperfilmulher.png'),
    'Marcos da Costa': assetUrl('images/fotoperfilhomem.png'),
    'Francisco Souza': assetUrl('images/fotoperfilhomem.png'),
  })[seed] ?? assetUrl('images/fotoperfilhomem.png')
const REGIONAL_TEAMS = [
  {
    regional: 'Regional 01',
    portfolioValue: 'R$ 184,6 mi',
    worksManaged: ['HotBox Fase 2', 'Pontilhões VP1', 'Integridade KM 50'],
    manager: { name: 'Jardson Magalhães', role: 'Gestor VALE', photo: avatarUrl('Jardson Magalhaes') },
    valePlanner: { name: 'Jennifer Sousa', role: 'Planejadora VALE', photo: avatarUrl('Jennifer Sousa') },
    arcadisPlanners: [
      { name: 'Marcos da Costa', role: 'Planejador Arcadis', photo: avatarUrl('Marcos da Costa') },
      { name: 'Francisco Souza', role: 'Planejador Arcadis', photo: avatarUrl('Francisco Souza') },
    ],
  },
  {
    regional: 'Regional 02',
    portfolioValue: 'R$ 231,2 mi',
    worksManaged: ['HotBox Fase 1', 'Pontilhões REG02', 'Integridade KM 374/375'],
    manager: { name: 'Jardson Magalhães', role: 'Gestor VALE Regional II', photo: avatarUrl('Jardson Magalhaes') },
    valePlanner: { name: 'Jennifer Sousa', role: 'Planejadora VALE', photo: avatarUrl('Jennifer Sousa') },
    arcadisPlanners: [
      { name: 'Marcos da Costa', role: 'Planejador Arcadis', photo: avatarUrl('Marcos da Costa') },
      { name: 'Francisco Souza', role: 'Planejador Arcadis', photo: avatarUrl('Francisco Souza') },
    ],
  },
  {
    regional: 'Regional 03',
    portfolioValue: 'R$ 297,8 mi',
    worksManaged: ['PRAD', 'Pontilhões REG03', 'HotBox 763/779/839'],
    manager: { name: 'Jardson Magalhães', role: 'Gestor VALE', photo: avatarUrl('Jardson Magalhaes') },
    valePlanner: { name: 'Jennifer Sousa', role: 'Planejadora VALE', photo: avatarUrl('Jennifer Sousa') },
    arcadisPlanners: [
      { name: 'Marcos da Costa', role: 'Planejador Arcadis', photo: avatarUrl('Marcos da Costa') },
      { name: 'Francisco Souza', role: 'Planejador Arcadis', photo: avatarUrl('Francisco Souza') },
    ],
  },
]

const state = {
  data: null,
  map: null,
  baseLayer: null,
  mapQuality: 'high',
  homeBounds: null,
  legendOpen: true,
  expandedCategory: null,
  selectedDevices: new Set(),
  hoveredDeviceKey: null,
  filters: {
    category: 'ALL',
    segment: 'ALL',
    search: '',
  },
  activeId: null,
  focusTarget: null,
  markers: new Map(),
  milestoneMarkers: new Map(),
  lineLayers: new Map(),
  overviewMap: null,
  overviewHost: null,
  overviewTileLayer: null,
  overviewSegmentLayer: null,
  overviewViewportLayer: null,
  overviewCurrentMarker: null,
  tilePrefetchCache: new Set(),
  tileLoadsPending: 0,
  visibleWorks: [],
  deviceGroups: [],
  autoplay: {
    playing: false,
    timer: null,
    rafId: null,
    mode: 'step',
    route: null,
    distance: 0,
    lastTs: 0,
    speedMps: 797.3,
    zoom: 11.3,
    transitionMs: 1400,
    stepMs: 12400,
    currentSegment: null,
  },
}

init().catch((error) => {
  console.error(error)
  app.innerHTML = `<div class="error-state"><h1>Falha ao carregar o dashboard</h1><p>${error.message}</p></div>`
})

async function init() {
  const response = await fetch(assetUrl('data/efc-data.json'))
  if (!response.ok) {
    throw new Error('Não foi possível carregar os dados da EFC.')
  }

  state.data = await response.json()
  state.deviceGroups = buildDeviceGroups(state.data.works)
  state.visibleWorks = state.data.works
  state.activeId = state.data.works[0]?.id ?? null
  state.expandedCategory = state.deviceGroups[0]?.key ?? null

  renderShell()
  buildMap()
  bindFilters()
  render()
  updateFullscreenButton()
  window.setTimeout(() => {
    if (!state.autoplay.playing) toggleAutoplay()
  }, 900)
}

function renderShell() {
  const categories = Object.entries(state.data.summary.categories)
  const segments = Object.entries(state.data.summary.segments)

  app.innerHTML = `
    <div class="page-shell">
      <section class="workspace">
        <div class="map-column">
          <div class="map-stage">
            <div id="map"></div>
            <div class="map-overlay header-bar">
              <header class="app-header">
                <div>
                  <p class="app-kicker">EFC Presentation Mode</p>
                  <strong class="app-title">Dashboard Executivo EFC</strong>
                </div>
                <span class="app-status">Mapa interativo em acompanhamento</span>
              </header>
            </div>
            <div class="map-overlay top-dock">
              <section class="toolbar-panel">
                <div class="toolbar map-toolbar">
                  <label>
                    <span>Categoria</span>
                    <select id="categoryFilter">
                      <option value="ALL">Todas</option>
                      ${categories.map(([key, value]) => `<option value="${key}">${value.label}</option>`).join('')}
                    </select>
                  </label>
                  <label>
                    <span>Trecho</span>
                    <select id="segmentFilter">
                      <option value="ALL">Todos</option>
                      ${segments.map(([key]) => `<option value="${key}">${key}</option>`).join('')}
                    </select>
                  </label>
                  <label>
                    <span>Busca</span>
                    <input id="searchFilter" type="search" placeholder="KM, dispositivo, detalhe..." />
                  </label>
                </div>
              </section>
              <div class="top-dock-right">
                <section class="detail-card top-detail-card" id="detailCard"></section>
                <div id="mapLegend"></div>
              </div>
            </div>
            <div class="map-overlay controls" id="mapControls">
              <div class="control-stack zoom-stack">
                <button id="mapZoomOutButton" class="toolbar-button" type="button" aria-label="Diminuir zoom">−</button>
                <button id="mapZoomInButton" class="toolbar-button" type="button" aria-label="Aumentar zoom">+</button>
                <button id="mapQualityToggle" class="toolbar-button subtle" type="button">Qualidade: Alta</button>
                <button id="mapAutoplayModeToggle" class="toolbar-button subtle" type="button">Modo: Arrastar</button>
              </div>
              <button id="mapAutoplayToggle" class="toolbar-button" type="button">Play</button>
              <button id="mapResetViewButton" class="toolbar-button subtle" type="button">Vista original · Espaço</button>
              <button id="mapFullscreenToggle" class="toolbar-button" type="button">Tela cheia</button>
            </div>
            <div class="map-overlay regional-focus" id="mapRegionalFocus"></div>
            <div class="map-overlay spotlight" id="mapSpotlightCard"></div>
            <div class="map-overlay org" id="mapOrgCard"></div>
          </div>
        </div>

        <aside class="side-panel">
          <section class="list-card">
            <div class="list-header">
              <h2>Dispositivos</h2>
              <span id="resultsCount"></span>
            </div>
            <div id="selectedSummary" class="selected-summary"></div>
            <div id="deviceCards" class="device-cards"></div>
          </section>
        </aside>
      </section>
    </div>
  `
}

function buildMap() {
  state.map = L.map('map', { zoomControl: false })
  L.control.zoom({ position: 'bottomright' }).addTo(state.map)

  applyBaseLayerQuality()

  const bounds = []

  state.data.lines.forEach((line) => {
    const polyline = L.polyline(line.points, {
      color: line.color,
      weight: 5,
      opacity: 0.88,
    })
      .addTo(state.map)
      .bindTooltip(line.name, { sticky: true })

    state.lineLayers.set(line.name, polyline)

    bounds.push(...line.points)
  })

  state.data.works.forEach((work) => {
    const marker = L.marker(work.position, {
      icon: L.divIcon({
        className: 'work-marker-shell',
        html: `<span class="work-marker" style="--marker:${work.color}"></span>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      }),
    })

    marker.on('click', () => {
      stopAutoplay()
      state.activeId = work.id
      state.focusTarget = { type: 'work', id: work.id }
      render()
    })

    marker.bindTooltip(`${work.categoryLabel} • KM ${work.km}`, { direction: 'top' })
    marker.addTo(state.map)
    state.markers.set(work.id, marker)
    bounds.push(work.position)
  })

  ;(state.data.kmMilestones ?? []).forEach((milestone) => {
    const marker = L.marker(milestone.position, {
      interactive: false,
      icon: L.divIcon({
        className: 'km-marker-shell',
        html: `
          <span class="km-marker-dot"></span>
          <span class="km-marker-label">KM ${milestone.km}</span>
        `,
        iconSize: [56, 18],
        iconAnchor: [8, 9],
      }),
    })

    marker.addTo(state.map)
    state.milestoneMarkers.set(milestone.id, marker)
  })

  if (bounds.length) {
    state.homeBounds = L.latLngBounds(bounds)
    state.map.fitBounds(state.homeBounds, { padding: [28, 28] })
  }

  const syncOverview = () => updateOverviewMap()
  state.map.on('move', syncOverview)
  state.map.on('zoom', syncOverview)
  state.map.on('resize', syncOverview)
  state.map.on('move', updateMarkerTooltips)
  state.map.on('zoom', updateMarkerTooltips)
  state.map.on('moveend', updateMarkerTooltips)
  state.map.on('zoomend', updateMarkerTooltips)
  state.map.on('zoomend', () => {
    state.autoplay.zoom = state.map.getZoom()
  })
}

function bindFilters() {
  document.querySelector('#categoryFilter').addEventListener('change', (event) => {
    stopAutoplay()
    state.filters.category = event.target.value
    state.focusTarget = null
    render()
  })

  document.querySelector('#segmentFilter').addEventListener('change', (event) => {
    stopAutoplay()
    state.filters.segment = event.target.value
    state.focusTarget = null
    render()
  })

  document.querySelector('#searchFilter').addEventListener('input', (event) => {
    stopAutoplay()
    state.filters.search = event.target.value.trim().toLowerCase()
    state.focusTarget = null
    render()
  })

  document.querySelector('#mapZoomInButton').addEventListener('click', () => adjustMapZoom(1))
  document.querySelector('#mapZoomOutButton').addEventListener('click', () => adjustMapZoom(-1))
  document.querySelector('#mapQualityToggle').addEventListener('click', toggleMapQuality)
  document.querySelector('#mapAutoplayModeToggle').addEventListener('click', toggleAutoplayMode)
  document.querySelector('#mapResetViewButton').addEventListener('click', resetMapView)
  document.querySelector('#mapFullscreenToggle').addEventListener('click', toggleFullscreen)
  document.querySelector('#mapAutoplayToggle').addEventListener('click', toggleAutoplay)

  document.addEventListener('fullscreenchange', () => {
    updateFullscreenButton()
    updateMapQualityButton()
    updateAutoplayModeButton()
    window.setTimeout(() => state.map?.invalidateSize(), 120)
    window.setTimeout(() => state.overviewMap?.invalidateSize(), 160)
  })

  document.addEventListener('keydown', (event) => {
    if (event.code !== 'Space' || isInteractiveTarget(event.target)) return
    event.preventDefault()
    resetMapView()
  })

  document.querySelectorAll('[data-category-chip]').forEach((button) => {
    button.addEventListener('click', () => {
      state.filters.category = button.dataset.categoryChip
      document.querySelector('#categoryFilter').value = state.filters.category
      state.activeId = null
      render()
    })
  })

  document.querySelectorAll('[data-segment-chip]').forEach((button) => {
    button.addEventListener('click', () => {
      state.filters.segment = button.dataset.segmentChip
      document.querySelector('#segmentFilter').value = state.filters.segment
      state.activeId = null
      render()
    })
  })
}

function render() {
  state.visibleWorks = state.data.works.filter((work) => {
    const matchesCategory =
      state.filters.category === 'ALL' || work.category === state.filters.category
    const matchesSegment =
      state.filters.segment === 'ALL' || work.segment === state.filters.segment
    const matchesDevice =
      state.selectedDevices.size === 0 || state.selectedDevices.has(deviceKey(work))
    const searchBase = `${work.km} ${work.title} ${work.detail} ${work.categoryLabel}`.toLowerCase()
    const matchesSearch =
      !state.filters.search || searchBase.includes(state.filters.search)

    return matchesCategory && matchesSegment && matchesDevice && matchesSearch
  })

  if (!state.visibleWorks.some((work) => work.id === state.activeId)) {
    state.activeId = state.visibleWorks[0]?.id ?? null
  }

  if (state.autoplay.playing && !state.visibleWorks.length) {
    stopAutoplay()
  }

  updateMarkers()
  updateMarkerTooltips()
  updateMilestones()
  updateLineHighlights()
  syncMapViewport()
  renderDetails()
  renderDeviceCards()
  renderMapCards()
  renderRegionalFocus()
  renderLegend()
  renderAutoplayUi()
  prefetchEntryTargets()
}

function syncMapViewport() {
  if (!state.map || !state.visibleWorks.length) return
  if (state.autoplay.playing && state.autoplay.route) return

  if (state.focusTarget?.type === 'work') {
    const activeWork = state.visibleWorks.find((work) => work.id === state.focusTarget.id)
    if (activeWork) {
      focusWork(activeWork, { zoom: 17 })
      return
    }
  }

  if (state.focusTarget?.type === 'device') {
    const works = state.visibleWorks.filter((work) => deviceKey(work) === state.focusTarget.key)
    if (works.length) {
      if (works.length === 1) {
        focusWork(works[0], { zoom: 17 })
        return
      }
      focusBounds(works)
      return
    }
  }

  focusBounds(state.visibleWorks)
}

function focusBounds(works) {
  if (!works.length || !state.map) return
  const bounds = L.latLngBounds(works.map((work) => work.position))
  state.map.fitBounds(bounds, { padding: [48, 48], maxZoom: 17 })
}

function updateMarkers() {
  state.data.works.forEach((work) => {
    const marker = state.markers.get(work.id)
    const isVisible = state.visibleWorks.some((item) => item.id === work.id)
    const isActive = state.activeId === work.id
    const isHighlighted =
      state.hoveredDeviceKey === deviceKey(work) || state.selectedDevices.has(deviceKey(work))
    if (!marker) return

    if (isVisible) {
      marker.addTo(state.map)
    } else {
      marker.remove()
    }

    const element = marker.getElement()
    if (element) {
      element.classList.toggle('is-active', isActive)
      element.classList.toggle('is-highlighted', isHighlighted)
      element.classList.toggle('is-dimmed', !isActive && !isHighlighted && isVisible)
    }
  })
}

function updateMarkerTooltips() {
  if (!state.map) return

  const bounds = state.map.getBounds()

  state.data.works.forEach((work) => {
    const marker = state.markers.get(work.id)
    if (!marker) return

    const isVisible = state.visibleWorks.some((item) => item.id === work.id)
    const inViewport = isVisible && bounds.contains(L.latLng(work.position))

    if (inViewport) {
      marker.openTooltip()
    } else {
      marker.closeTooltip()
    }
  })
}

function updateMilestones() {
  ;(state.data.kmMilestones ?? []).forEach((milestone) => {
    const marker = state.milestoneMarkers.get(milestone.id)
    if (!marker) return

    const isVisible =
      state.filters.segment === 'ALL' || milestone.segment === state.filters.segment

    if (isVisible) {
      marker.addTo(state.map)
    } else {
      marker.remove()
    }
  })
}

function updateLineHighlights() {
  const activeWork = state.visibleWorks.find((work) => work.id === state.activeId)

  state.data.lines.forEach((line) => {
    const layer = state.lineLayers.get(line.name)
    if (!layer) return

    const isActiveSegment = activeWork?.segment === line.name
    layer.setStyle({
      color: line.color,
      weight: isActiveSegment ? 8 : 4,
      opacity: isActiveSegment ? 1 : state.autoplay.playing ? 0.34 : 0.78,
    })

    const element = layer.getElement?.()
    if (element) {
      element.classList.toggle('line-is-active', isActiveSegment)
      element.classList.toggle('line-is-muted', !isActiveSegment && state.autoplay.playing)
    }
  })
}

function renderDetails() {
  const activeWork = state.visibleWorks.find((work) => work.id === state.activeId)
  const detailCard = document.querySelector('#detailCard')

  if (!activeWork) {
    detailCard.innerHTML = `<div class="empty-state"><p>Nenhum dispositivo encontrado com os filtros atuais.</p></div>`
    return
  }

  detailCard.innerHTML = `
    <div class="detail-surface" style="${categoryArtworkStyle(activeWork.category)}">
      <div class="detail-topline">
        <span class="pill" style="--pill:${activeWork.color}">${activeWork.categoryLabel}</span>
        <span class="pill dark">${activeWork.segment}</span>
      </div>
      <h2>${activeWork.categoryLabel}</h2>
      <h3>${activeWork.title}</h3>
      <p>${activeWork.detail}</p>
    </div>
  `
}

function renderDeviceCards() {
  const container = document.querySelector('#deviceCards')
  const selectedSummary = document.querySelector('#selectedSummary')
  const resultsCount = document.querySelector('#resultsCount')

  resultsCount.textContent = `${state.visibleWorks.length} ponto(s)`
  selectedSummary.innerHTML = `
    <button class="selection-chip ${state.selectedDevices.size === 0 ? 'active' : ''}" id="clearDeviceSelection" type="button">
      Todos os dispositivos
    </button>
    ${
      state.selectedDevices.size
        ? `<span class="selection-count">${state.selectedDevices.size} selecionado(s)</span>`
        : ''
    }
  `

  document.querySelector('#clearDeviceSelection')?.addEventListener('click', () => {
    state.selectedDevices.clear()
    state.hoveredDeviceKey = null
    state.focusTarget = null
    render()
  })

  container.innerHTML = state.deviceGroups
    .map((group) => {
      const isOpen = state.expandedCategory === group.key
      return `
        <article class="device-card ${isOpen ? 'open' : ''}">
          <button class="device-card-head" data-group-key="${group.key}" type="button" style="${categoryArtworkStyle(group.key)}">
            <div>
              <span class="device-card-overline">${group.label}</span>
              <strong>${group.devices.length} dispositivo(s)</strong>
            </div>
            <span class="device-card-meta">${group.count} ponto(s)</span>
          </button>
          ${
            isOpen
              ? `
                <div class="device-card-body">
                  ${group.devices
                    .map(
                      (device) => `
                        <button
                          class="device-option ${state.selectedDevices.has(device.key) ? 'selected' : ''}"
                          data-device-key="${device.key}"
                          type="button"
                        >
                          <span class="device-option-title">${device.title}</span>
                          <span class="device-option-meta">${device.kmLabel}</span>
                          <small>${device.detail}</small>
                        </button>
                      `,
                    )
                    .join('')}
                </div>
              `
              : ''
          }
        </article>
      `
    })
    .join('')

  container.querySelectorAll('[data-group-key]').forEach((button) => {
    button.addEventListener('click', () => {
      state.expandedCategory = state.expandedCategory === button.dataset.groupKey ? null : button.dataset.groupKey
      renderDeviceCards()
    })
  })

  container.querySelectorAll('[data-device-key]').forEach((button) => {
    button.addEventListener('mouseenter', () => {
      state.hoveredDeviceKey = button.dataset.deviceKey
      updateMarkers()
    })

    button.addEventListener('mouseleave', () => {
      state.hoveredDeviceKey = null
      updateMarkers()
    })

    button.addEventListener('focus', () => {
      state.hoveredDeviceKey = button.dataset.deviceKey
      updateMarkers()
    })

    button.addEventListener('blur', () => {
      state.hoveredDeviceKey = null
      updateMarkers()
    })

    button.addEventListener('click', () => {
      stopAutoplay()
      const key = button.dataset.deviceKey
      if (state.selectedDevices.has(key)) {
        state.selectedDevices.delete(key)
      } else {
        state.selectedDevices.add(key)
      }
      state.hoveredDeviceKey = key
      state.focusTarget = { type: 'device', key }
      state.activeId = null
      render()
    })
  })
}

function renderMapCards() {
  const mapOrgCard = document.querySelector('#mapOrgCard')
  const activeWork = state.visibleWorks.find((work) => work.id === state.activeId)

  if (!mapOrgCard) return

  if (!activeWork) {
    mapOrgCard.innerHTML = ''
    return
  }

  const team = teamForWork(activeWork)
  mapOrgCard.innerHTML = renderRegionalCard(team, true)
}

function renderRegionalFocus() {
  const focus = document.querySelector('#mapRegionalFocus')
  const activeWork = state.visibleWorks.find((work) => work.id === state.activeId)
  const segmentName = activeWork?.segment

  if (!focus) return
  if (!activeWork && !segmentName) {
    focus.innerHTML = ''
    return
  }

  const workForTeam = activeWork ?? state.visibleWorks.find((work) => work.segment === segmentName)
  if (!workForTeam || !segmentName) {
    focus.innerHTML = ''
    return
  }

  const team = teamForWork(workForTeam)
  const regionalLabel = team.regional.replace('Regional ', 'REGIONAL ')

  focus.innerHTML = `
    <div class="regional-focus-card" style="--regional-color:${segmentColor(segmentName)}">
      <div class="regional-focus-minimap" id="regionalFocusMiniMap" aria-hidden="true"></div>
      <div class="regional-focus-copy">
        <span class="regional-focus-kicker">Trecho em análise</span>
        <strong>${regionalLabel}</strong>
      </div>
    </div>
  `

  ensureOverviewMap(segmentName, activeWork)
}

function ensureOverviewMap(segmentName, activeWork) {
  const host = document.querySelector('#regionalFocusMiniMap')
  if (!host || !state.map) return

  if (state.overviewHost !== host) {
    state.overviewMap?.remove()
    state.overviewHost = host
    state.overviewMap = L.map(host, {
      attributionControl: false,
      zoomControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      touchZoom: false,
      tap: false,
      zoomSnap: 0.1,
    })

    state.overviewTileLayer = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        maxZoom: 18,
      },
    ).addTo(state.overviewMap)

    state.overviewSegmentLayer = L.polyline([], {
      color: '#ffffff',
      weight: 3,
      opacity: 0.92,
    }).addTo(state.overviewMap)

    state.overviewViewportLayer = L.rectangle(
      [
        [0, 0],
        [0, 0],
      ],
      {
        color: '#111827',
        weight: 1.5,
        opacity: 0.95,
        fillColor: '#ffffff',
        fillOpacity: 0.1,
      },
    ).addTo(state.overviewMap)

    state.overviewCurrentMarker = L.circleMarker([0, 0], {
      radius: 4,
      color: '#111827',
      weight: 2,
      fillColor: '#ffffff',
      fillOpacity: 0.95,
    }).addTo(state.overviewMap)
  }

  updateOverviewMap(segmentName, activeWork)
  window.setTimeout(() => state.overviewMap?.invalidateSize(), 0)
}

function updateOverviewMap(segmentNameParam, activeWorkParam) {
  if (!state.map || !state.overviewMap || !state.data) return

  const activeWork =
    activeWorkParam ?? state.visibleWorks.find((work) => work.id === state.activeId) ?? state.visibleWorks[0]
  const segmentName = segmentNameParam ?? activeWork?.segment
  if (!segmentName) return

  const line = state.data.lines.find((item) => item.name === segmentName)
  if (!line?.points?.length) return

  state.overviewSegmentLayer?.setLatLngs(line.points)
  state.overviewSegmentLayer?.setStyle({ color: line.color })

  const segmentBounds = L.latLngBounds(line.points)
  state.overviewMap.fitBounds(segmentBounds, {
    padding: [12, 12],
    maxZoom: 11,
    animate: false,
  })

  const currentBounds = state.map.getBounds()
  state.overviewViewportLayer?.setBounds(currentBounds)

  const currentCenter = activeWork?.position ?? state.map.getCenter()
  state.overviewCurrentMarker?.setLatLng(currentCenter)
}

function renderAutoplayUi() {
  const autoplayButton = document.querySelector('#mapAutoplayToggle')
  const spotlight = document.querySelector('#mapSpotlightCard')
  const activeWork = state.visibleWorks.find((work) => work.id === state.activeId)

  if (autoplayButton) {
    autoplayButton.textContent = state.autoplay.playing ? 'Pausar' : 'Play'
    autoplayButton.classList.toggle('active', state.autoplay.playing)
  }

  if (!spotlight) return

  if (!state.autoplay.playing || !activeWork) {
    spotlight.innerHTML = ''
    spotlight.classList.remove('is-visible')
    spotlight.classList.remove('is-transitioning')
    return
  }

  const nextMarkup = `
    <article class="spotlight-card" style="${categoryArtworkStyle(activeWork.category)}">
      <div class="spotlight-headerline">
        <span class="pill" style="--pill:${activeWork.color}">${activeWork.categoryLabel}</span>
        <span class="pill dark">${activeWork.segment}</span>
        <span class="pill white legend-pill" aria-label="${activeWork.categoryLabel}">
          <span class="legend-pill-symbol" style="--marker:${activeWork.color}"></span>
        </span>
        <div class="segment-emphasis" style="--segment-color:${segmentColor(activeWork.segment)}">
          <span class="segment-dot"></span>
          <strong>${activeWork.segment}</strong>
        </div>
        <span class="spotlight-km">KM ${activeWork.km}</span>
      </div>
      <h3>${activeWork.title}</h3>
      <p>${activeWork.detail}</p>
    </article>
  `

  if (!spotlight.innerHTML) {
    spotlight.innerHTML = nextMarkup
    spotlight.classList.remove('is-transitioning')
    requestAnimationFrame(() => spotlight.classList.add('is-visible'))
    return
  }

  spotlight.classList.add('is-transitioning')
  window.clearTimeout(spotlight._swapTimer)
  spotlight._swapTimer = window.setTimeout(() => {
    spotlight.innerHTML = nextMarkup
    spotlight.classList.remove('is-transitioning')
    spotlight.classList.add('is-visible')
  }, state.autoplay.transitionMs)
}

function renderLegend() {
  const mapLegend = document.querySelector('#mapLegend')
  if (!mapLegend) return
  mapLegend.innerHTML = ''
}

function buildDeviceGroups(works) {
  const categoryMap = new Map()

  works.forEach((work) => {
    if (!categoryMap.has(work.category)) {
      categoryMap.set(work.category, {
        key: work.category,
        label: work.categoryLabel,
        color: work.color,
        count: 0,
        devices: new Map(),
      })
    }

    const category = categoryMap.get(work.category)
    category.count += 1

    const key = deviceKey(work)
    if (!category.devices.has(key)) {
      category.devices.set(key, {
        key,
        title: work.title,
        detail: shortDetail(work.detail),
        kms: [],
      })
    }

    category.devices.get(key).kms.push(work.km)
  })

  return [...categoryMap.values()].map((group) => ({
    ...group,
    devices: [...group.devices.values()]
      .map((device) => ({
        ...device,
        kmLabel: kmLabel(device.kms),
      }))
      .sort((a, b) => a.kms[0] - b.kms[0]),
  }))
}

function resetMapView() {
  stopAutoplay()
  state.focusTarget = null
  if (!state.visibleWorks.length) return
  focusBounds(state.visibleWorks)
}

function focusWork(work, options = {}) {
  state.map.flyTo(work.position, options.zoom ?? 17, { duration: 6.5 })
}

function adjustMapZoom(delta) {
  if (!state.map) return

  const currentZoom = state.map.getZoom()
  const nextZoom = Math.max(3, Math.min(18, currentZoom + delta))
  state.autoplay.zoom = Math.max(3, Math.min(18, state.autoplay.zoom + delta))

  if (state.autoplay.playing && state.autoplay.route) {
    const currentPoint = pointAlongRoute(state.autoplay.route, state.autoplay.distance) ?? state.map.getCenter()
    state.map.setView(currentPoint, nextZoom, { animate: false })
    return
  }

  state.map.setView(state.map.getCenter(), nextZoom, { animate: false })
}

function toggleMapQuality() {
  state.mapQuality = state.mapQuality === 'high' ? 'low' : 'high'
  applyBaseLayerQuality()
  updateMapQualityButton()
}

function toggleAutoplayMode() {
  const wasPlaying = state.autoplay.playing
  if (wasPlaying) stopAutoplay()

  state.autoplay.mode = state.autoplay.mode === 'route' ? 'step' : 'route'
  if (state.autoplay.mode === 'step' && state.mapQuality !== 'high') {
    state.mapQuality = 'high'
    applyBaseLayerQuality()
    updateMapQualityButton()
  }
  updateAutoplayModeButton()
  renderAutoplayUi()

  if (wasPlaying) toggleAutoplay()
}

function updateMapQualityButton() {
  const button = document.querySelector('#mapQualityToggle')
  if (!button) return
  button.textContent = `Qualidade: ${state.mapQuality === 'high' ? 'Alta' : 'Baixa'}`
  button.classList.toggle('active', state.mapQuality === 'high')
}

function updateAutoplayModeButton() {
  const button = document.querySelector('#mapAutoplayModeToggle')
  if (!button) return
  button.textContent = `Modo: ${state.autoplay.mode === 'route' ? 'Arrastar' : 'Dispositivo'}`
  button.classList.toggle('active', state.autoplay.mode === 'route')
}

function applyBaseLayerQuality() {
  if (!state.map) return

  if (state.baseLayer) {
    state.baseLayer.remove()
  }

  state.tileLoadsPending = 0
  state.baseLayer = createBaseLayer(state.mapQuality).addTo(state.map)
  bindBaseLayerEvents(state.baseLayer)
}

function createBaseLayer(quality) {
  return L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 18,
    maxNativeZoom: quality === 'high' ? 18 : 10,
    attribution: 'Tiles © Esri',
    updateWhenZooming: quality === 'high',
    updateWhenIdle: quality !== 'high',
    keepBuffer: quality === 'high' ? 4 : 1,
  })
}

function bindBaseLayerEvents(layer) {
  layer.on('tileloadstart', () => {
    state.tileLoadsPending += 1
  })

  const finishTileLoad = () => {
    state.tileLoadsPending = Math.max(0, state.tileLoadsPending - 1)
  }

  layer.on('tileload', finishTileLoad)
  layer.on('tileerror', finishTileLoad)
}

async function toggleFullscreen() {
  const stage = document.querySelector('.map-stage')
  if (!stage) return

  if (document.fullscreenElement) {
    await document.exitFullscreen()
  } else {
    await stage.requestFullscreen()
  }
}

function toggleAutoplay() {
  if (state.autoplay.playing) {
    stopAutoplay()
    renderAutoplayUi()
    renderRegionalFocus()
    return
  }

  if (!state.visibleWorks.length) return

  if (state.autoplay.mode === 'step') {
    startStepAutoplay()
    return
  }

  const route = buildAutoplayRoute()
  if (!route) return

  state.autoplay.playing = true
  state.autoplay.route = route
  state.autoplay.distance = route.startDistance ?? 0
  state.autoplay.lastTs = 0
  state.autoplay.currentSegment = segmentAtDistance(route, state.autoplay.distance)
  state.focusTarget = null
  const initialWork = nearestWorkOnRoute(state.autoplay.distance, route)
  state.activeId = initialWork?.id ?? orderedVisibleWorks()[0]?.id ?? null
  prefetchEntryTargets()
  prefetchRouteAhead(state.autoplay.distance, route)
  render()
  runAutoplayFrame(performance.now())
}

function startStepAutoplay() {
  const works = orderedVisibleWorks()
  if (!works.length) return

  state.autoplay.playing = true
  state.autoplay.route = null
  state.autoplay.distance = 0
  state.autoplay.lastTs = 0

  const currentIndex = works.findIndex((work) => work.id === state.activeId)
  const activeWork = currentIndex >= 0 ? works[currentIndex] : works[0]

  state.activeId = activeWork.id
  state.autoplay.currentSegment = activeWork.segment
  state.focusTarget = { type: 'work', id: activeWork.id }

  prefetchEntryTargets()
  focusWork(activeWork, { zoom: state.autoplay.zoom, duration: 2.8 })
  render()
  scheduleStepAutoplay()
}

function stopAutoplay() {
  state.autoplay.playing = false
  state.autoplay.route = null
  state.autoplay.distance = 0
  state.autoplay.lastTs = 0
  state.autoplay.currentSegment = null
  if (state.autoplay.timer) {
    clearTimeout(state.autoplay.timer)
    state.autoplay.timer = null
  }
  if (state.autoplay.rafId) {
    cancelAnimationFrame(state.autoplay.rafId)
    state.autoplay.rafId = null
  }
}

function scheduleStepAutoplay() {
  if (!state.autoplay.playing || state.autoplay.mode !== 'step') return
  if (state.autoplay.timer) clearTimeout(state.autoplay.timer)

  state.autoplay.timer = setTimeout(() => {
    advanceStepAutoplay()
    scheduleStepAutoplay()
  }, state.autoplay.stepMs)
}

function advanceStepAutoplay() {
  const works = orderedVisibleWorks()
  if (!works.length) {
    stopAutoplay()
    render()
    return
  }

  const currentIndex = works.findIndex((work) => work.id === state.activeId)
  const nextWork = currentIndex >= 0 ? works[(currentIndex + 1) % works.length] : works[0]

  state.activeId = nextWork.id
  state.autoplay.currentSegment = nextWork.segment
  state.focusTarget = { type: 'work', id: nextWork.id }

  prefetchTilesForWork(nextWork, Math.round(state.autoplay.zoom))
  focusWork(nextWork, { zoom: state.autoplay.zoom, duration: 2.8 })
  render()
}

function runAutoplayFrame(timestamp) {
  if (!state.autoplay.playing || !state.autoplay.route || !state.map) return

  const route = state.autoplay.route
  if (!state.autoplay.lastTs) {
    state.autoplay.lastTs = timestamp
  }

  const elapsedSeconds = Math.min((timestamp - state.autoplay.lastTs) / 1000, 0.2)
  state.autoplay.lastTs = timestamp

  const pendingFactor = state.tileLoadsPending > 0 ? 0.42 : 1
  const nearestWork = nearestWorkOnRoute(state.autoplay.distance, route)
  const nearWorkDistance = nearestWork ? Math.abs(nearestWork.routeDistance - state.autoplay.distance) : Infinity
  const emphasisFactor = nearWorkDistance < 220 ? 0.38 : nearWorkDistance < 420 ? 0.62 : 1
  const stepDistance = state.autoplay.speedMps * pendingFactor * emphasisFactor * elapsedSeconds

  state.autoplay.distance += Math.max(stepDistance, 1.2)
  if (state.autoplay.distance > route.endDistance) {
    state.autoplay.distance = route.startDistance
  }

  const cameraPoint = pointAlongRoute(route, state.autoplay.distance)
  if (cameraPoint) {
    state.map.setView(cameraPoint, state.autoplay.zoom, { animate: false })
  }

  prefetchRouteAhead(state.autoplay.distance, route)
  syncAutoplayContext(route)
  state.autoplay.rafId = requestAnimationFrame(runAutoplayFrame)
}

function syncAutoplayContext(route) {
  const segmentName = segmentAtDistance(route, state.autoplay.distance)
  const nearestWork = nearestWorkOnRoute(state.autoplay.distance, route)
  const nextActiveId = nearestWork?.id ?? state.activeId
  const shouldRender =
    state.autoplay.currentSegment !== segmentName || (nextActiveId && nextActiveId !== state.activeId)

  state.autoplay.currentSegment = segmentName
  if (nextActiveId) {
    state.activeId = nextActiveId
  }

  if (shouldRender) {
    renderDetails()
    renderMapCards()
    renderRegionalFocus()
    renderAutoplayUi()
    updateMarkers()
    updateLineHighlights()
  }
}

function orderedVisibleWorks() {
  return [...state.visibleWorks].sort((a, b) => Number(a.km) - Number(b.km))
}

function segmentColor(segmentName) {
  return state.data.lines.find((line) => line.name === segmentName)?.color ?? '#ffffff'
}

function prefetchNextAutoplayTarget() {
  if (!state.autoplay.playing || !state.autoplay.route) return
  prefetchRouteAhead(state.autoplay.distance, state.autoplay.route)
}

function prefetchEntryTargets() {
  if (!state.map || !state.baseLayer) return

  const works = orderedVisibleWorks()
  if (!works.length) return

  const targets = []
  const activeWork = works.find((work) => work.id === state.activeId)
  if (activeWork) targets.push(activeWork)

  works.slice(0, 3).forEach((work) => {
    if (!targets.some((item) => item.id === work.id)) {
      targets.push(work)
    }
  })

  targets.forEach((work) => prefetchTilesForWork(work, 17))
}

function buildAutoplayRoute() {
  const segmentOrder = ['EFC I', 'EFC II', 'EFC III']
  const routeSegments =
    state.filters.segment === 'ALL'
      ? segmentOrder
      : segmentOrder.filter((segment) => segment === state.filters.segment)

  if (!routeSegments.length) return null

  const points = []
  const segmentRanges = []
  let totalDistance = 0
  let previousPoint = null

  routeSegments.forEach((segmentName) => {
    const line = state.data.lines.find((item) => item.name === segmentName)
    if (!line?.points?.length) return

    const startDistance = totalDistance
    line.points.forEach((point, index) => {
      if (previousPoint && index === 0 && samePoint(previousPoint, point)) {
        return
      }

      if (previousPoint) {
        totalDistance += distanceBetween(previousPoint, point)
      }

      points.push({
        latlng: point,
        distance: totalDistance,
        segment: segmentName,
      })
      previousPoint = point
    })

    segmentRanges.push({
      name: segmentName,
      start: startDistance,
      end: totalDistance,
    })
  })

  if (points.length < 2 || totalDistance <= 0) return null

  const works = orderedVisibleWorks()
    .filter((work) => routeSegments.includes(work.segment))
    .map((work) => ({
      ...work,
      routeDistance: nearestRouteDistanceForPoint(work.position, points),
    }))
    .sort((a, b) => a.routeDistance - b.routeDistance)

  const paddingMeters = 220
  const startDistance = works.length
    ? Math.max(0, works[0].routeDistance - paddingMeters)
    : 0
  const endDistance = works.length
    ? Math.min(totalDistance, works.at(-1).routeDistance + paddingMeters)
    : totalDistance

  return {
    points,
    totalDistance,
    segmentRanges,
    works,
    startDistance,
    endDistance,
  }
}

function prefetchRouteAhead(currentDistance, route) {
  if (!route || !state.baseLayer || !state.map) return

  const distances = [currentDistance, currentDistance + 280, currentDistance + 620, currentDistance + 1100]
  distances.forEach((distance) => {
    const point = pointAlongRoute(route, wrapRouteDistance(distance, route))
    if (point) {
      prefetchTilesForLatLng(point, Math.round(state.autoplay.zoom))
    }
  })
}

function prefetchTilesForLatLng(position, zoom) {
  if (!position || !state.map || !state.baseLayer) return

  const tileSize = state.baseLayer.getTileSize()
  const crs = state.map.options.crs
  const pixelPoint = crs.latLngToPoint(L.latLng(position), zoom)
  const centerTile = pixelPoint.unscaleBy(tileSize).floor()

  for (let dx = -1; dx <= 1; dx += 1) {
    for (let dy = -1; dy <= 1; dy += 1) {
      const coords = L.point(centerTile.x + dx, centerTile.y + dy)
      const url = state.baseLayer.getTileUrl({ x: coords.x, y: coords.y, z: zoom })
      if (state.tilePrefetchCache.has(url)) continue
      state.tilePrefetchCache.add(url)
      warmImage(url)
    }
  }

  trimPrefetchCache()
}

function prefetchTilesForWork(work, zoom) {
  if (!work || !state.map || !state.baseLayer) return
  prefetchTilesForLatLng(work.position, zoom)
}

function warmImage(url) {
  const image = new Image()
  image.decoding = 'async'
  image.loading = 'eager'
  image.src = url
}

function trimPrefetchCache() {
  const maxEntries = 240
  if (state.tilePrefetchCache.size <= maxEntries) return
  const entries = [...state.tilePrefetchCache]
  const overflow = entries.length - maxEntries
  for (let index = 0; index < overflow; index += 1) {
    state.tilePrefetchCache.delete(entries[index])
  }
}

function pointAlongRoute(route, distance) {
  if (!route?.points?.length) return null
  if (distance <= 0) return route.points[0].latlng
  if (distance >= route.totalDistance) return route.points.at(-1).latlng

  for (let index = 1; index < route.points.length; index += 1) {
    const previous = route.points[index - 1]
    const current = route.points[index]
    if (distance > current.distance) continue
    const span = current.distance - previous.distance || 1
    const ratio = (distance - previous.distance) / span
    return [
      previous.latlng[0] + (current.latlng[0] - previous.latlng[0]) * ratio,
      previous.latlng[1] + (current.latlng[1] - previous.latlng[1]) * ratio,
    ]
  }

  return route.points.at(-1).latlng
}

function wrapRouteDistance(distance, route) {
  if (!route) return distance
  const start = route.startDistance ?? 0
  const end = route.endDistance ?? route.totalDistance ?? distance
  const span = Math.max(end - start, 1)
  if (distance < start) return start
  if (distance <= end) return distance
  return start + ((distance - start) % span)
}

function segmentAtDistance(route, distance) {
  return (
    route.segmentRanges.find((segment) => distance >= segment.start && distance <= segment.end)?.name ??
    route.segmentRanges.at(-1)?.name ??
    null
  )
}

function nearestWorkOnRoute(distance, route) {
  if (!route?.works?.length) return null

  let nearest = route.works[0]
  let delta = Math.abs(nearest.routeDistance - distance)

  route.works.forEach((work) => {
    const currentDelta = Math.abs(work.routeDistance - distance)
    if (currentDelta < delta) {
      nearest = work
      delta = currentDelta
    }
  })

  return nearest
}


function nearestRouteDistanceForPoint(position, routePoints) {
  let nearestDistance = 0
  let nearestDelta = Number.POSITIVE_INFINITY

  routePoints.forEach((point) => {
    const delta = distanceBetween(position, point.latlng)
    if (delta < nearestDelta) {
      nearestDelta = delta
      nearestDistance = point.distance
    }
  })

  return nearestDistance
}

function distanceBetween(a, b) {
  return L.latLng(a[0], a[1]).distanceTo(L.latLng(b[0], b[1]))
}

function samePoint(a, b) {
  return Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9
}

function updateFullscreenButton() {
  const label = document.fullscreenElement ? 'Sair da tela cheia' : 'Tela cheia'
  document.querySelectorAll('#mapFullscreenToggle').forEach((button) => {
    button.textContent = label
  })
}

function rangeText(works) {
  if (!works.length) return '-'
  const kms = works.map((work) => work.km)
  return `${Math.min(...kms)}-${Math.max(...kms)}`
}

function deviceKey(work) {
  return `${work.category}::${work.title}`
}

function kmLabel(kms) {
  const ordered = [...new Set(kms)].sort((a, b) => a - b)
  return ordered.length > 4
    ? `KMs ${ordered.slice(0, 4).join(', ')}...`
    : `KMs ${ordered.join(', ')}`
}

function shortDetail(detail) {
  return detail.length > 80 ? `${detail.slice(0, 80).trim()}...` : detail
}

function isInteractiveTarget(target) {
  return target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(target.tagName)
}

function renderRegionalCard(team, compact = false) {
  return `
    <article class="regional-card ${compact ? 'compact' : ''}">
      <div class="regional-top">
        <div class="regional-summary">
          <span class="regional-label">${team.regional}</span>
          <strong class="regional-value">Carteira ${team.portfolioValue}</strong>
        </div>
      </div>

      <div class="org-tree">
        ${renderPersonNode(team.manager, 'manager')}
        <div class="org-line"></div>
        ${renderPersonNode(team.valePlanner, 'vale')}
        <div class="org-line short"></div>
        <div class="arcadis-row">
          ${team.arcadisPlanners.map((person) => renderPersonNode(person, 'arcadis')).join('')}
        </div>
      </div>

      <div class="regional-works">
        <span class="works-title">Gestão de obras</span>
        <div class="works-tags">
          ${team.worksManaged.map((work) => `<span class="work-tag">${work}</span>`).join('')}
        </div>
      </div>
    </article>
  `
}

function renderPersonNode(person, tone) {
  return `
    <div class="person-node ${tone}">
      <div class="avatar-shell ${person.photo ? 'has-photo' : ''}">
        ${
          person.photo
            ? `<img src="${person.photo}" alt="${person.name}" class="avatar-image" />`
            : `<span class="avatar-fallback">${initials(person.name)}</span>`
        }
      </div>
      <div class="person-meta">
        <strong>${person.name}</strong>
        <span>${person.role}</span>
      </div>
    </div>
  `
}

function initials(name) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((chunk) => chunk[0]?.toUpperCase() ?? '')
    .join('')
}

function teamForWork(work) {
  const segmentMap = {
    'EFC I': REGIONAL_TEAMS[0],
    'EFC II': REGIONAL_TEAMS[1],
    'EFC III': REGIONAL_TEAMS[2],
  }
  return segmentMap[work.segment] ?? REGIONAL_TEAMS[0]
}

function categoryArtworkStyle(category) {
  const image = categoryImage(category)
  return image ? `--card-art:url('${image}')` : ''
}

function categoryImage(category) {
  const images = {
    HOTBOX: assetUrl('images/hotbox.png'),
    PONTILHAO: assetUrl('images/pontilhao.png'),
    INTEGRIDADE: assetUrl('images/integridade-prad.png'),
    PRAD: assetUrl('images/integridade-prad.png'),
  }
  return images[category] ?? ''
}
