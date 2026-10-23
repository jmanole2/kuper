import * as THREE from 'three';

const section = document.getElementById('clientes');
const cloud = document.getElementById('clientsCloud');
const canvas = document.getElementById('clientsCloudCanvas');

const clients = [
  { name: 'Santa Clara', image: 'santa-clara.png' },
  { name: 'Yoplait', image: 'yoplait.png' },
  { name: 'Quesos Chilchota', image: 'chilchota.png' },
  { name: 'Lyncott', image: 'lyncott.png' },
  { name: 'Pinturas Acuario', image: 'acuario.png' },
  { name: 'Ingredion', image: 'ingredion.png' },
  { name: 'Leche Al Día', image: 'al-dia.png' },
  { name: 'Pintex', image: 'pintex.png' },
  { name: 'Barry Callebaut', image: 'barry-callebaut.png' },
  { name: 'Gertrude Hawk', image: 'gertrude-hawk.png' },
  { name: 'Sicao', image: 'sicao.png' },
  { name: 'Bensdorp', image: 'bensdorp.png' },
  { name: 'ASM', image: 'asm.png' }
];

if (section && cloud && canvas) {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const pointer = new THREE.Vector2(2, 2);
  const pointerTarget = new THREE.Vector2();
  const clock = new THREE.Clock();
  const tiles = [];
  let frame = 0;
  let visible = false;
  let marqueeTrackHeight = 1;
  let marqueeFadeStart = 0.35;
  let marqueeFadeEnd = 0.5;
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
  }

  if (renderer) {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.35));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-4, 4, 3, -3, 0.1, 30);
    camera.position.set(0, 0, 10);

    const group = new THREE.Group();
    scene.add(group);
    scene.add(new THREE.HemisphereLight(0xffffff, 0xc8b7bb, 2.35));

    const keyLight = new THREE.DirectionalLight(0xffffff, 3.1);
    keyLight.position.set(-4, 6, 8);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x9eb9d3, 1.35);
    rimLight.position.set(6, -2, 5);
    scene.add(rimLight);

    function roundedRect(context, x, y, width, height, radius) {
      context.beginPath();
      context.roundRect(x, y, width, height, radius);
      context.closePath();
    }

    function loadImage(source) {
      return new Promise((resolve, reject) => {
        const image = new Image();
        image.decoding = 'async';
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = source;
      });
    }

    async function createLogoTexture(client) {
      const image = await loadImage(`assets/images/clients/${client.image}`);
      const textureCanvas = document.createElement('canvas');
      textureCanvas.width = 512;
      textureCanvas.height = 512;
      const context = textureCanvas.getContext('2d');

      context.clearRect(0, 0, 512, 512);
      context.fillStyle = '#ffffff';
      roundedRect(context, 7, 7, 498, 498, 72);
      context.fill();
      context.strokeStyle = 'rgba(41, 65, 96, 0.09)';
      context.lineWidth = 7;
      context.stroke();

      const maxWidth = 390;
      const maxHeight = 330;
      const scale = Math.min(maxWidth / image.naturalWidth, maxHeight / image.naturalHeight);
      const width = image.naturalWidth * scale;
      const height = image.naturalHeight * scale;
      context.drawImage(image, (512 - width) / 2, (512 - height) / 2, width, height);

      const texture = new THREE.CanvasTexture(textureCanvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 4);
      return texture;
    }

    function createTile(texture, client, index) {
      const sideMaterial = new THREE.MeshStandardMaterial({
        color: 0xe4e1de,
        roughness: 0.46,
        metalness: 0.03,
        transparent: true,
        depthWrite: false
      });
      const backMaterial = new THREE.MeshStandardMaterial({
        color: 0xf7f6f4,
        roughness: 0.55,
        metalness: 0.02,
        transparent: true,
        depthWrite: false
      });
      const frontMaterial = new THREE.MeshStandardMaterial({
        map: texture,
        color: 0xffffff,
        roughness: 0.4,
        metalness: 0.015,
        transparent: true,
        depthWrite: false
      });
      const tile = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 0.09, 1, 1, 1),
        [sideMaterial, sideMaterial, sideMaterial, sideMaterial, frontMaterial, backMaterial]
      );

      tile.userData = {
        client,
        index,
        phase: index * 0.81,
        speed: 0.62 + (index % 4) * 0.075,
        base: new THREE.Vector3(),
        targetScale: 1
      };
      tile.rotation.z = ((index % 5) - 2) * 0.006;
      tile.name = client.name;
      group.add(tile);
      tiles.push(tile);
    }

    function applyLayout() {
      const rect = cloud.getBoundingClientRect();
      if (!rect.width || !rect.height) return;

      renderer.setSize(rect.width, rect.height, false);
      const aspect = rect.width / rect.height;
      const mobile = rect.width < 680;
      const viewHeight = mobile ? 8.55 : 5.2;
      const viewWidth = viewHeight * aspect;
      camera.top = viewHeight / 2;
      camera.bottom = -viewHeight / 2;
      camera.left = -viewWidth / 2;
      camera.right = viewWidth / 2;
      camera.updateProjectionMatrix();

      const rows = mobile ? [3, 3, 3, 2, 2] : [5, 4, 4];
      const size = mobile
        ? Math.min(1.17, (viewWidth - 0.38) / 3.45)
        : Math.min(1.18, (viewWidth - 0.5) / 5.55);
      const gapX = size * (mobile ? 1.26 : 1.34);
      const gapY = size * (mobile ? 1.31 : 1.37);
      const totalHeight = (rows.length - 1) * gapY;
      marqueeTrackHeight = gapY * rows.length;
      marqueeFadeEnd = marqueeTrackHeight / 2;
      marqueeFadeStart = marqueeFadeEnd - gapY * 0.55;
      let tileIndex = 0;

      rows.forEach((count, rowIndex) => {
        const y = totalHeight / 2 - rowIndex * gapY;
        for (let column = 0; column < count; column += 1) {
          const tile = tiles[tileIndex];
          if (!tile) return;
          const x = (column - (count - 1) / 2) * gapX;
          tile.userData.base.set(x, y, (tileIndex % 3) * 0.018);
          tile.position.copy(tile.userData.base);
          tile.scale.setScalar(size);
          tile.userData.layoutScale = size;
          tileIndex += 1;
        }
      });
    }

    function render() {
      frame = 0;
      if (!visible) return;

      const elapsed = clock.getElapsedTime();
      pointer.lerp(pointerTarget, 0.07);
      group.rotation.y += ((pointer.x * 0.025) - group.rotation.y) * 0.055;
      group.rotation.x += ((-pointer.y * 0.014) - group.rotation.x) * 0.055;
      group.position.x += ((pointer.x * 0.055) - group.position.x) * 0.05;
      group.position.y += ((pointer.y * 0.025) - group.position.y) * 0.05;

      const marqueeOffset = reducedMotion.matches ? 0 : elapsed * 0.33;
      const trackHalf = marqueeTrackHeight / 2;

      tiles.forEach(tile => {
        const { base, phase, speed, layoutScale } = tile.userData;
        const floatAmount = reducedMotion.matches ? 0 : Math.sin(elapsed * speed + phase) * 0.055;
        const depthAmount = reducedMotion.matches ? 0 : Math.cos(elapsed * 0.48 + phase) * 0.035;
        const desiredScale = layoutScale;
        const wrappedY = ((((base.y + marqueeOffset) + trackHalf) % marqueeTrackHeight) + marqueeTrackHeight) % marqueeTrackHeight - trackHalf;
        const targetY = wrappedY + floatAmount;
        const edgeFade = 1 - THREE.MathUtils.smoothstep(Math.abs(targetY), marqueeFadeStart, marqueeFadeEnd);

        tile.position.x += (base.x - tile.position.x) * 0.075;
        if (Math.abs(targetY - tile.position.y) > trackHalf) tile.position.y = targetY;
        else tile.position.y += (targetY - tile.position.y) * 0.075;
        tile.position.z += ((base.z + depthAmount) - tile.position.z) * 0.1;
        tile.rotation.x += ((floatAmount * 0.035) - tile.rotation.x) * 0.08;
        tile.rotation.y += ((depthAmount * 0.04) - tile.rotation.y) * 0.08;
        tile.scale.x += (desiredScale - tile.scale.x) * 0.11;
        tile.scale.y += (desiredScale - tile.scale.y) * 0.11;
        tile.scale.z += (desiredScale - tile.scale.z) * 0.11;
        tile.material.forEach(material => { material.opacity = edgeFade; });
        tile.visible = edgeFade > 0.015;
      });

      renderer.render(scene, camera);
      if (!reducedMotion.matches) frame = requestAnimationFrame(render);
    }

    function start() {
      visible = true;
      if (!frame) frame = requestAnimationFrame(render);
    }

    function stop() {
      visible = false;
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
    }

    Promise.all(clients.map(createLogoTexture))
      .then(textures => {
        textures.forEach((texture, index) => createTile(texture, clients[index], index));
        applyLayout();
        cloud.classList.add('is-webgl');

        const observer = new IntersectionObserver(entries => {
          if (entries[0]?.isIntersecting) start();
          else stop();
        }, { threshold: 0.08 });
        observer.observe(section);
      })
      .catch(error => {
        canvas.hidden = true;
        console.warn('No fue posible inicializar la nube de clientes.', error);
      });

    cloud.addEventListener('pointermove', event => {
      const rect = canvas.getBoundingClientRect();
      pointerTarget.set(
        ((event.clientX - rect.left) / Math.max(rect.width, 1)) * 2 - 1,
        -(((event.clientY - rect.top) / Math.max(rect.height, 1)) * 2 - 1)
      );
    }, { passive: true });

    cloud.addEventListener('pointerleave', () => {
      pointerTarget.set(0, 0);
      pointer.set(0, 0);
    }, { passive: true });

    window.addEventListener('resize', applyLayout, { passive: true });
    window.addEventListener('pagehide', () => {
      stop();
      tiles.forEach(tile => {
        tile.geometry.dispose();
        tile.material.forEach(material => {
          material.map?.dispose();
          material.dispose();
        });
      });
      renderer.dispose();
    }, { once: true });
  }
}
