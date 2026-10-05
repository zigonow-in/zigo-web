export function createMapLoading(surface, host, onTimeout = () => {}) {
  const indicator = surface.querySelector('[data-map-loading]');
  let map, sourceIds = [], busy = false, timer;
  const finish = () => {
    busy = false; clearTimeout(timer);
    indicator.hidden = true; host.setAttribute('aria-busy', 'false');
  };
  const render = () => {
    if (!busy || !map?.isStyleLoaded()) return;
    if (sourceIds.every(id => map.getSource(id) && map.isSourceLoaded(id))) finish();
  };
  const begin = () => {
    busy = true; indicator.hidden = false; host.setAttribute('aria-busy', 'true');
    clearTimeout(timer);
    timer = setTimeout(() => { finish(); onTimeout(); }, 20000);
    map?.triggerRepaint();
  };
  const disconnect = () => { map?.off('render', render); map?.off('error', finish); };
  begin();
  return {
    begin, fail: finish,
    connect(next, ids) { disconnect(); map = next; sourceIds = ids; map.on('render', render); map.on('error', finish); map.triggerRepaint(); },
    destroy() { disconnect(); finish(); map = null; }
  };
}
