import * as THREE from 'three';

const section = document.getElementById('materiaPrima');
const canvases = Array.from(document.querySelectorAll('.material-icon-canvas'));

if (section && canvases.length) {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const scenes = [];
  let visible = false;
  let frame = 0;

  function shapeFromPoints(points) {
    const shape = new THREE.Shape();
    shape.moveTo(points[0].x, points[0].y);
    points.slice(1).forEach(point => shape.lineTo(point.x, point.y));
    shape.closePath();
    return shape;
  }

  // Silueta calcada de la referencia: tres flechas y sus tres pliegues. Las
  // coordenadas conservan tanto las proporciones como los espacios del icono
  // original, en vez de aproximarlo mediante rotaciones de una sola pieza.
  const referenceSilhouette = [
    [
      [-0.419, 0.125], [-0.356, 0.100], [-0.294, -0.175],
      [-0.369, -0.125], [-0.419, -0.138], [-0.756, -0.713],
      [-0.856, -0.500], [-0.581, -0.050], [-0.581, -0.013],
      [-0.669, 0.050]
    ],
    [
      [-0.069, 0.787], [0.131, 0.787], [0.369, 0.362],
      [0.406, 0.325], [0.506, 0.362], [0.431, 0.100],
      [0.156, 0.163], [0.231, 0.212], [0.231, 0.275]
    ],
    [
      [0.206, -0.425], [0.231, -0.525], [0.856, -0.537],
      [0.756, -0.700], [0.231, -0.700], [0.206, -0.800],
      [0.031, -0.625]
    ],
    [
      [-0.581, -0.550], [-0.206, -0.550],
      [-0.206, -0.750], [-0.694, -0.750]
    ],
    [
      [-0.144, 0.738], [-0.106, 0.725], [-0.031, 0.563],
      [-0.181, 0.300], [-0.219, 0.287], [-0.331, 0.350],
      [-0.344, 0.400]
    ],
    [
      [0.619, -0.087], [0.656, -0.087], [0.856, -0.450],
      [0.656, -0.450], [0.631, -0.412], [0.494, -0.175]
    ]
  ];
  const symbolShapes = referenceSilhouette.map(points => shapeFromPoints(
    points.map(([x, y]) => new THREE.Vector2(x, y))
  ));

  const extrusionOptions = {
    depth: 0.09,
    bevelEnabled: true,
    bevelSegments: 2,
    bevelSize: 0.018,
    bevelThickness: 0.022,
    curveSegments: 1
  };
  const symbolGeometry = new THREE.ExtrudeGeometry(symbolShapes, extrusionOptions);
  symbolGeometry.translate(0, 0, -0.045);

  function buildIcon(canvas, index) {
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        powerPreference: 'low-power'
      });
    } catch (error) {
      canvas.hidden = true;
      return null;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.35));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 20);
    camera.position.set(0, 0, 5.2);

    const group = new THREE.Group();
    const material = new THREE.MeshStandardMaterial({
      color: 0x6f2339,
      metalness: 0.12,
      roughness: 0.32,
      side: THREE.DoubleSide
    });

    const symbol = new THREE.Mesh(symbolGeometry, material);
    group.add(symbol);

    group.scale.setScalar(1.52);
    group.rotation.x = -0.02;
    scene.add(group);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x9c6f7c, 2.1));
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.8);
    keyLight.position.set(-2.5, 4, 5);
    scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight(0xb58b47, 1.4);
    rimLight.position.set(4, -2, 3);
    scene.add(rimLight);

    function resize() {
      const width = Math.max(canvas.clientWidth, 1);
      const height = Math.max(canvas.clientHeight, 1);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    }

    resize();
    return {
      canvas,
      renderer,
      scene,
      camera,
      group,
      material,
      keyLight,
      resize,
      phase: index * 0.85,
      pointerX: 0,
      pointerY: 0,
      targetX: 0,
      targetY: 0
    };
  }

  canvases.forEach((canvas, index) => {
    const icon = buildIcon(canvas, index);
    if (icon) scenes.push(icon);
  });

  function draw(time = 0) {
    frame = 0;
    const seconds = time * 0.001;

    scenes.forEach(icon => {
      icon.pointerX += (icon.targetX - icon.pointerX) * 0.075;
      icon.pointerY += (icon.targetY - icon.pointerY) * 0.075;

      icon.group.rotation.y = Math.sin(seconds * 0.48 + icon.phase) * 0.012 + icon.pointerX * 0.035;
      icon.group.rotation.x = -0.02 + Math.cos(seconds * 0.37 + icon.phase) * 0.008 - icon.pointerY * 0.03;
      icon.group.rotation.z = 0;
      icon.group.position.x = icon.pointerX * 0.025;
      icon.group.position.y = -icon.pointerY * 0.02;
      icon.keyLight.position.x = -2.5 + icon.pointerX * 3.2;
      icon.keyLight.position.y = 4 - icon.pointerY * 2.4;
      icon.renderer.render(icon.scene, icon.camera);
    });

    if (visible && !reducedMotion.matches) frame = requestAnimationFrame(draw);
  }

  function start() {
    visible = true;
    if (!frame) frame = requestAnimationFrame(draw);
  }

  function stop() {
    visible = false;
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
  }

  function resizeAll() {
    scenes.forEach(icon => icon.resize());
    if (reducedMotion.matches) draw();
  }

  function updatePointer(event) {
    scenes.forEach(icon => {
      const rect = icon.canvas.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      icon.targetX = THREE.MathUtils.clamp((event.clientX - centerX) / Math.max(rect.width, 1), -1.15, 1.15);
      icon.targetY = THREE.MathUtils.clamp((event.clientY - centerY) / Math.max(rect.height, 1), -1.15, 1.15);
    });
  }

  function resetPointer() {
    scenes.forEach(icon => {
      icon.targetX = 0;
      icon.targetY = 0;
    });
  }

  const observer = new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting)) start();
    else stop();
  }, { rootMargin: '160px 0px' });

  observer.observe(section);
  window.addEventListener('resize', resizeAll);
  section.addEventListener('pointermove', updatePointer, { passive: true });
  section.addEventListener('pointerleave', resetPointer, { passive: true });
  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches) {
      stop();
      draw();
    } else if (section.getBoundingClientRect().top < window.innerHeight) {
      start();
    }
  });

  draw();

  window.addEventListener('pagehide', () => {
    stop();
    observer.disconnect();
    symbolGeometry.dispose();
    scenes.forEach(icon => {
      icon.material.dispose();
      icon.renderer.dispose();
    });
  }, { once: true });
}
