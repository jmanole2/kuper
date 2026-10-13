import * as THREE from 'three';

const section = document.getElementById('coverage');
const mapWrap = document.getElementById('coverageMap');
const canvas = document.getElementById('coverageCanvas');

if (section && mapWrap && canvas) {
  const tooltip = document.getElementById('coverageTooltip');
  const tooltipName = document.getElementById('coverageTooltipName');
  const tooltipStatus = document.getElementById('coverageTooltipStatus');
  const fallback = document.getElementById('coverageMapFallback');
  const eyebrowNumber = document.getElementById('coverageNum');
  const eyebrowLabel = document.getElementById('coverageLabel');
  const nationalCopy = section.querySelector('.coverage-phase-national');
  const internationalCopy = section.querySelector('.coverage-phase-international');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const palette = {
    direct: 0x4c95a7,
    office: 0x74283d,
    inactive: 0xa3a5a8,
    border: 0xf5f1ee,
    hover: 0xc29351
  };

  const cssColors = {
    direct: '#4c95a7',
    office: '#74283d',
    inactive: '#a3a5a8'
  };

  const directStates = new Set([
    'aguascalientes',
    'baja california',
    'campeche',
    'chihuahua',
    'coahuila de zaragoza',
    'durango',
    'guanajuato',
    'guerrero',
    'hidalgo',
    'jalisco',
    'nuevo leon',
    'oaxaca',
    'puebla',
    'quintana roo',
    'san luis potosi',
    'tabasco',
    'tlaxcala',
    'veracruz de ignacio de la llave'
  ]);

  const officeStates = new Map([
    ['mexico', 'Oficinas centrales y planta de producción'],
    ['yucatan', 'Oficina de representación']
  ]);

  const directCountries = new Set([
    'United States of America',
    'Mexico',
    'Dominican Republic',
    'Jamaica',
    'Barbados',
    'Grenada',
    'Guyana',
    'Trinidad and Tobago'
  ]);

  const stateDisplayNames = new Map([
    ['coahuila de zaragoza', 'Coahuila'],
    ['distrito federal', 'Ciudad de México'],
    ['mexico', 'Estado de México'],
    ['michoacan de ocampo', 'Michoacán'],
    ['nuevo leon', 'Nuevo León'],
    ['queretaro de arteaga', 'Querétaro'],
    ['san luis potosi', 'San Luis Potosí'],
    ['veracruz de ignacio de la llave', 'Veracruz'],
    ['yucatan', 'Yucatán']
  ]);

  const normalize = value => value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
  const smoothstep = (min, max, value) => {
    const t = clamp((value - min) / (max - min));
    return t * t * (3 - 2 * t);
  };

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
  } catch (error) {
    canvas.hidden = true;
    if (fallback) fallback.hidden = false;
  }

  if (renderer) {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 300);
    camera.position.z = 100;

    const countriesLayer = new THREE.Group();
    const statesLayer = new THREE.Group();
    const officeMarkersLayer = new THREE.Group();
    const marketMarkersLayer = new THREE.Group();
    scene.add(countriesLayer, statesLayer, officeMarkersLayer, marketMarkersLayer);

    const stateFeatures = [];
    const countryFeatures = [];
    const officeMarkers = [];
    const marketMarkers = [];
    const statePickables = [];
    const countryPickables = [];
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    let hoveredFeature = null;
    let touchHideTimer = null;
    let mapProgress = 0;
    let internationalMix = 0;
    let currentViewHeight = 36;
    let currentCenterX = -102;
    let currentCenterY = 23.5;
    let scrollQueued = false;

    function normalizeLongitude(longitude) {
      return longitude > 20 ? longitude - 360 : longitude;
    }

    function ringToPoints(ring) {
      const points = ring.map(([longitude, latitude]) => (
        new THREE.Vector2(normalizeLongitude(longitude), latitude)
      ));

      if (
        points.length > 1
        && points[0].x === points.at(-1).x
        && points[0].y === points.at(-1).y
      ) {
        points.pop();
      }
      return points;
    }

    function createPolygonMesh(polygon, featureGroup, zIndex) {
      if (!polygon?.length || polygon[0].length < 4) return;

      const outer = ringToPoints(polygon[0]);
      if (outer.length < 3) return;
      if (!THREE.ShapeUtils.isClockWise(outer)) outer.reverse();

      const shape = new THREE.Shape(outer);
      polygon.slice(1).forEach(ring => {
        const holePoints = ringToPoints(ring);
        if (holePoints.length < 3) return;
        if (THREE.ShapeUtils.isClockWise(holePoints)) holePoints.reverse();
        shape.holes.push(new THREE.Path(holePoints));
      });

      const fillMaterial = new THREE.MeshBasicMaterial({
        color: featureGroup.userData.baseColor,
        transparent: true,
        opacity: 1,
        side: THREE.DoubleSide,
        depthWrite: true
      });
      const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), fillMaterial);
      mesh.position.z = zIndex;
      mesh.userData.featureGroup = featureGroup;
      mesh.userData.opacityFactor = 1;
      mesh.renderOrder = Math.round(zIndex * 100);
      featureGroup.userData.fillMaterials.push(fillMaterial);
      featureGroup.userData.pickables.push(mesh);
      featureGroup.add(mesh);

      polygon.forEach(ring => {
        const outlinePoints = ringToPoints(ring);
        if (outlinePoints.length < 2) return;
        outlinePoints.push(outlinePoints[0].clone());
        const lineGeometry = new THREE.BufferGeometry().setFromPoints(
          outlinePoints.map(point => new THREE.Vector3(point.x, point.y, zIndex + 0.025))
        );
        const lineMaterial = new THREE.LineBasicMaterial({
          color: palette.border,
          transparent: true,
          opacity: 0.92,
          depthWrite: false
        });
        const line = new THREE.Line(lineGeometry, lineMaterial);
        line.userData.opacityFactor = 0.92;
        line.renderOrder = mesh.renderOrder + 1;
        featureGroup.add(line);
      });
    }

    function createFeature(feature, options) {
      const group = new THREE.Group();
      group.userData = {
        name: options.name,
        status: options.status,
        statusKey: options.statusKey,
        baseColor: options.baseColor,
        fillMaterials: [],
        pickables: []
      };

      const geometry = feature.geometry;
      const polygons = geometry.type === 'Polygon'
        ? [geometry.coordinates]
        : geometry.coordinates;

      polygons.forEach(polygon => createPolygonMesh(polygon, group, options.zIndex));
      options.layer.add(group);
      options.collection.push(group);
      options.pickableCollection.push(...group.userData.pickables);
      return group;
    }

    function setFeatureOpacity(feature, opacity) {
      feature.visible = opacity > 0.005;
      feature.traverse(child => {
        if (!child.material) return;
        child.material.opacity = opacity * (child.userData.opacityFactor ?? 1);
      });
    }

    function setFeatureHovered(feature, hovered) {
      feature.userData.fillMaterials.forEach(material => {
        material.color.setHex(hovered ? palette.hover : feature.userData.baseColor);
      });
    }

    function createMarker({ longitude, latitude, name, status, statusKey, color, layer, collection, pickables }) {
      const group = new THREE.Group();
      group.position.set(normalizeLongitude(longitude), latitude, 1.4);
      group.userData = {
        name,
        status,
        statusKey,
        baseColor: color,
        fillMaterials: [],
        pickables: [],
        marker: true
      };

      const ringMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.92,
        depthTest: false
      });
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.72, 1.08, 28), ringMaterial);
      ring.userData.opacityFactor = 0.92;
      ring.renderOrder = 400;
      group.add(ring);

      const dotMaterial = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 1,
        depthTest: false
      });
      const dot = new THREE.Mesh(new THREE.CircleGeometry(0.68, 28), dotMaterial);
      dot.userData.featureGroup = group;
      dot.userData.opacityFactor = 1;
      dot.renderOrder = 401;
      group.userData.fillMaterials.push(dotMaterial);
      group.userData.pickables.push(dot);
      group.add(dot);

      layer.add(group);
      collection.push(group);
      pickables.push(dot);
      return group;
    }

    function stateDetails(rawName) {
      const key = normalize(rawName);
      const displayName = stateDisplayNames.get(key) || rawName;
      if (officeStates.has(key)) {
        return {
          name: displayName,
          status: officeStates.get(key),
          statusKey: 'office',
          color: palette.office
        };
      }
      if (directStates.has(key)) {
        return {
          name: displayName,
          status: 'Presencia directa con clientes y distribución',
          statusKey: 'direct',
          color: palette.direct
        };
      }
      return {
        name: displayName,
        status: 'Sin presencia directa',
        statusKey: 'inactive',
        color: palette.inactive
      };
    }

    function countryDetails(properties) {
      const isDirect = directCountries.has(properties.admin);
      const isMexico = properties.admin === 'Mexico';
      return {
        name: properties.name || properties.admin,
        status: isMexico
          ? 'Presencia directa y oficinas centrales'
          : (isDirect ? 'Presencia directa con clientes y distribución' : 'Sin presencia directa'),
        statusKey: isDirect ? 'direct' : 'inactive',
        color: isDirect ? palette.direct : palette.inactive
      };
    }

    function updateCamera() {
      const rect = mapWrap.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const aspect = rect.width / rect.height;
      camera.left = -currentViewHeight * aspect / 2;
      camera.right = currentViewHeight * aspect / 2;
      camera.top = currentViewHeight / 2;
      camera.bottom = -currentViewHeight / 2;
      camera.position.x = currentCenterX;
      camera.position.y = currentCenterY;
      camera.updateProjectionMatrix();

      const markerScale = currentViewHeight / rect.height * 5.2;
      [...officeMarkers, ...marketMarkers].forEach(marker => marker.scale.setScalar(markerScale));
    }

    function resizeRenderer() {
      const width = Math.max(1, Math.round(mapWrap.clientWidth));
      const height = Math.max(1, Math.round(mapWrap.clientHeight));
      renderer.setSize(width, height, false);
      updateCamera();
      renderer.render(scene, camera);
    }

    function clearHover() {
      if (hoveredFeature) setFeatureHovered(hoveredFeature, false);
      hoveredFeature = null;
      canvas.style.cursor = 'crosshair';
      tooltip?.classList.remove('visible');
      tooltip?.setAttribute('aria-hidden', 'true');
      renderer.render(scene, camera);
    }

    function showTooltip(event, feature) {
      if (!tooltip || !tooltipName || !tooltipStatus) return;
      const rect = mapWrap.getBoundingClientRect();
      const maxLeft = Math.max(8, rect.width - Math.min(225, tooltip.offsetWidth || 225) - 8);
      const maxTop = Math.max(8, rect.height - Math.min(80, tooltip.offsetHeight || 80) - 8);
      const left = clamp(event.clientX - rect.left + 16, 8, maxLeft);
      const top = clamp(event.clientY - rect.top + 16, 8, maxTop);

      tooltipName.textContent = feature.userData.name;
      tooltipStatus.textContent = feature.userData.status;
      tooltip.style.left = `${left}px`;
      tooltip.style.top = `${top}px`;
      tooltip.style.setProperty('--tooltip-color', cssColors[feature.userData.statusKey]);
      tooltip.classList.add('visible');
      tooltip.setAttribute('aria-hidden', 'false');
    }

    function findFeatureAtPointer(event) {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return null;
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);

      const activePickables = internationalMix > 0.52 ? countryPickables : statePickables;
      const hit = raycaster
        .intersectObjects(activePickables, false)
        .find((intersection) => (
          intersection.object.userData.featureGroup?.userData.statusKey !== 'inactive'
        ));
      return hit?.object?.userData?.featureGroup || null;
    }

    function handlePointer(event) {
      const feature = findFeatureAtPointer(event);
      if (!feature) {
        clearHover();
        return;
      }

      if (hoveredFeature !== feature) {
        if (hoveredFeature) setFeatureHovered(hoveredFeature, false);
        hoveredFeature = feature;
        setFeatureHovered(feature, true);
      }
      canvas.style.cursor = 'pointer';
      showTooltip(event, feature);
      renderer.render(scene, camera);

      if (event.pointerType !== 'mouse') {
        window.clearTimeout(touchHideTimer);
        touchHideTimer = window.setTimeout(clearHover, 2600);
      }
    }

    function updateFromScroll() {
      scrollQueued = false;
      const rect = section.getBoundingClientRect();
      const scrollRange = Math.max(section.offsetHeight - window.innerHeight, 1);
      mapProgress = clamp(-rect.top / scrollRange);

      const rawZoom = smoothstep(0.12, 0.82, mapProgress);
      const zoomProgress = reduceMotion ? (mapProgress >= 0.5 ? 1 : 0) : rawZoom;
      internationalMix = reduceMotion
        ? (mapProgress >= 0.5 ? 1 : 0)
        : smoothstep(0.46, 0.72, mapProgress);

      currentViewHeight = THREE.MathUtils.lerp(36, 147, zoomProgress);
      currentCenterX = THREE.MathUtils.lerp(-102, -94, zoomProgress);
      currentCenterY = THREE.MathUtils.lerp(23.5, 16, zoomProgress);

      const countryOpacity = smoothstep(0.22, 0.54, mapProgress);
      const stateOpacity = 1 - smoothstep(0.5, 0.74, mapProgress);
      const internationalMarkerOpacity = smoothstep(0.38, 0.64, mapProgress);
      const officeOpacity = THREE.MathUtils.lerp(1, 0.82, zoomProgress);
      const phaseBoundary = 0.59;
      const phaseExitSpan = (window.innerHeight * 0.35) / scrollRange;
      const phaseEnterSpan = 180 / scrollRange;
      const nationalFocus = reduceMotion
        ? (mapProgress < phaseBoundary ? 1 : 0)
        : 1 - smoothstep(phaseBoundary - phaseExitSpan, phaseBoundary, mapProgress);
      const internationalFocus = reduceMotion
        ? (mapProgress >= phaseBoundary ? 1 : 0)
        : smoothstep(phaseBoundary, phaseBoundary + phaseEnterSpan, mapProgress);

      countriesLayer.visible = countryOpacity > 0.005;
      statesLayer.visible = stateOpacity > 0.005;
      marketMarkersLayer.visible = internationalMarkerOpacity > 0.005;

      countryFeatures.forEach(feature => setFeatureOpacity(feature, countryOpacity));
      stateFeatures.forEach(feature => setFeatureOpacity(feature, stateOpacity));
      marketMarkers.forEach(marker => setFeatureOpacity(marker, internationalMarkerOpacity));
      officeMarkers.forEach(marker => setFeatureOpacity(marker, officeOpacity));

      section.style.setProperty('--coverage-phase', internationalMix.toFixed(4));
      const internationalActive = internationalMix >= 0.5;
      if (eyebrowNumber) eyebrowNumber.textContent = internationalActive ? '06' : '05';
      if (eyebrowLabel) eyebrowLabel.textContent = internationalActive
        ? 'COBERTURA INTERNACIONAL'
        : 'COBERTURA NACIONAL';
      if (nationalCopy) {
        nationalCopy.style.opacity = nationalFocus.toFixed(3);
        nationalCopy.style.visibility = nationalFocus > 0.005 ? 'visible' : 'hidden';
        nationalCopy.style.transform = `translateY(${((1 - nationalFocus) * 18).toFixed(1)}px)`;
        nationalCopy.classList.toggle('is-active', !internationalActive);
        nationalCopy.setAttribute('aria-hidden', String(nationalFocus <= 0.005));
      }
      if (internationalCopy) {
        internationalCopy.style.opacity = internationalFocus.toFixed(3);
        internationalCopy.style.visibility = internationalFocus > 0.005 ? 'visible' : 'hidden';
        internationalCopy.style.transform = `translateY(${((1 - internationalFocus) * 18).toFixed(1)}px)`;
        internationalCopy.classList.toggle('is-active', internationalActive);
        internationalCopy.setAttribute('aria-hidden', String(internationalFocus <= 0.005));
      }

      clearHover();
      updateCamera();
      renderer.render(scene, camera);
    }

    function requestScrollUpdate() {
      if (scrollQueued) return;
      scrollQueued = true;
      requestAnimationFrame(updateFromScroll);
    }

    async function buildMap() {
      const [statesResponse, countriesResponse] = await Promise.all([
        fetch('assets/data/mexico-states.geojson'),
        fetch('assets/data/americas-countries.geojson')
      ]);
      if (!statesResponse.ok || !countriesResponse.ok) throw new Error('No fue posible cargar la cartografía.');

      const [statesData, countriesData] = await Promise.all([
        statesResponse.json(),
        countriesResponse.json()
      ]);

      countriesData.features.forEach(feature => {
        const details = countryDetails(feature.properties);
        createFeature(feature, {
          ...details,
          baseColor: details.color,
          zIndex: 0,
          layer: countriesLayer,
          collection: countryFeatures,
          pickableCollection: countryPickables
        });
      });

      statesData.features.forEach(feature => {
        const details = stateDetails(feature.properties.name);
        createFeature(feature, {
          ...details,
          baseColor: details.color,
          zIndex: 0.72,
          layer: statesLayer,
          collection: stateFeatures,
          pickableCollection: statePickables
        });
      });

      [
        {
          longitude: -99.72,
          latitude: 19.35,
          name: 'Estado de México',
          status: 'Oficinas centrales y planta de producción'
        },
        {
          longitude: -89.0,
          latitude: 20.7,
          name: 'Yucatán',
          status: 'Oficina de representación'
        }
      ].forEach(marker => {
        const officeMarker = createMarker({
          ...marker,
          statusKey: 'office',
          color: palette.office,
          layer: officeMarkersLayer,
          collection: officeMarkers,
          pickables: statePickables
        });
        countryPickables.push(...officeMarker.userData.pickables);
      });

      [
        { longitude: -70.5, latitude: 18.9, name: 'República Dominicana' },
        { longitude: -77.3, latitude: 18.1, name: 'Jamaica' },
        { longitude: -59.55, latitude: 13.2, name: 'Barbados' },
        { longitude: -61.67, latitude: 12.1, name: 'Granada' },
        { longitude: -58.9, latitude: 4.8, name: 'Guyana' },
        { longitude: -61.2, latitude: 10.5, name: 'Trinidad y Tobago' }
      ].forEach(marker => createMarker({
        ...marker,
        status: 'Presencia directa con clientes y distribución',
        statusKey: 'direct',
        color: palette.direct,
        layer: marketMarkersLayer,
        collection: marketMarkers,
        pickables: countryPickables
      }));

      resizeRenderer();
      updateFromScroll();
    }

    canvas.addEventListener('pointermove', handlePointer);
    canvas.addEventListener('pointerdown', handlePointer);
    canvas.addEventListener('pointerleave', clearHover);
    window.addEventListener('scroll', requestScrollUpdate, { passive: true });
    window.addEventListener('resize', resizeRenderer, { passive: true });

    if ('ResizeObserver' in window) {
      new ResizeObserver(resizeRenderer).observe(mapWrap);
    }

    buildMap().catch(error => {
      console.error(error);
      canvas.hidden = true;
      if (fallback) fallback.hidden = false;
    });
  }
}
