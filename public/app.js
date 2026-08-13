// app.js - KissKH LightKD Client Application
(function () {
  let art = null;
  let currentDrama = null;
  let currentEpisodes = [];
  let currentEpIndex = -1;
  let searchDebounceTimer = null;
  let isPlayingLoading = false;

  // Custom SVG Icons for Controls
  const ICONS = {
    play: `<svg width="22" height="22" viewBox="0 0 36 36" fill="none"><path d="M11.286 4.723A1.5 1.5 0 0 0 9 6v24a1.5 1.5 0 0 0 2.286 1.277l19.5-12a1.5 1.5 0 0 0 0-2.555l-19.5-12z" fill="#fff"/></svg>`,
    pause: `<svg width="22" height="22" viewBox="0 0 36 36" fill="none"><path fill-rule="evenodd" clip-rule="evenodd" d="M24 3.75A2.25 2.25 0 0 1 26.25 6v24a2.25 2.25 0 1 1-4.5 0V6A2.25 2.25 0 0 1 24 3.75zm-12 0A2.25 2.25 0 0 1 14.25 6v24a2.25 2.25 0 1 1-4.5 0V6A2.25 2.25 0 0 1 12 3.75z" fill="#fff"/></svg>`,
    prev10s: `<svg width="20" height="20" viewBox="0 0 28 31" fill="none"><path fill-rule="evenodd" clip-rule="evenodd" d="M5.393 2.476A1.5 1.5 0 1 0 3.115.524L.361 3.737a1.504 1.504 0 0 0-.35 1.153 1.49 1.49 0 0 0 .35.8l2.754 3.212A1.5 1.5 0 1 0 5.393 6.95L3.476 4.713l1.917-2.237zM.191 5.446c.05.09.11.174.177.252l-.007-.009a1.5 1.5 0 0 1 0-1.952l.007-.008A1.504 1.504 0 0 0 .01 4.89c.023.193.083.382.18.556zm13.703.767H4.76l-1.285-1.5 1.285-1.5h9.133c7.42 0 13.893 6.474 13.893 13.894S21.313 31 13.894 31C6.473 31 0 24.526 0 17.107a1.5 1.5 0 0 1 3 0C3 22.869 8.13 28 13.893 28c5.763 0 10.894-5.13 10.894-10.893 0-5.763-5.13-10.894-10.893-10.894zm3.92 12.735c-.152.171-.364.256-.634.256-.405 0-.689-.211-.85-.634-.153-.423-.23-1.179-.23-2.268 0-.756.036-1.336.108-1.742.072-.414.184-.706.338-.877.152-.18.364-.27.634-.27.405 0 .684.211.837.634.162.423.243 1.175.243 2.255 0 .756-.036 1.341-.108 1.755-.072.414-.184.711-.338.891zm-3.348.985c.63.846 1.535 1.27 2.714 1.27 1.188 0 2.093-.424 2.713-1.27.63-.846.945-2.056.945-3.631 0-1.575-.315-2.781-.945-3.618-.63-.846-1.534-1.269-2.713-1.269-1.188 0-2.097.423-2.727 1.269-.621.837-.931 2.043-.931 3.618 0 1.575.314 2.785.944 3.631zm-4.975-5.845V21h2.578v-9.355H9.83l-2.606 1.133v1.877l2.268-.567z" fill="#fff"/></svg>`,
    next10s: `<svg width="20" height="20" viewBox="0 0 28 31" fill="none"><path fill-rule="evenodd" clip-rule="evenodd" d="M22.394 2.476A1.5 1.5 0 1 1 24.672.524l2.754 3.213-.007-.008c.23.263.368.608.368.984 0 .377-.139.72-.368.984l-2.747 3.205a1.5 1.5 0 1 1-2.278-1.952l.632-.737h-9.133C8.131 6.213 3 11.343 3 17.107 3 22.869 8.13 28 13.893 28c5.763 0 10.894-5.13 10.894-10.893a1.5 1.5 0 0 1 3 0c0 7.42-6.474 13.893-13.894 13.893S0 24.526 0 17.107C0 9.687 6.474 3.213 13.893 3.213h9.133l-.632-.737zm-4.08 16.472c-.153.171-.364.256-.634.256-.405 0-.689-.211-.85-.634-.154-.423-.23-1.179-.23-2.268 0-.756.036-1.336.108-1.742.072-.414.184-.706.337-.877.153-.18.365-.27.635-.27.405 0 .684.211.837.634.162.423.243 1.175.243 2.255 0 .756-.036 1.341-.108 1.755-.072.414-.185.711-.338.891zm-3.348.985c.63.846 1.535 1.27 2.714 1.27 1.188 0 2.092-.424 2.713-1.27.63-.846.945-2.056.945-3.631 0-1.575-.315-2.781-.945-3.618-.63-.846-1.534-1.269-2.713-1.269-1.188 0-2.097.423-2.727 1.269-.621.837-.932 2.043-.932 3.618 0 1.575.315 2.785.945 3.631zM9.99 14.088V21h2.579v-9.355h-2.241l-2.606 1.133v1.877l2.268-.567z" fill="#fff"/></svg>`
  };

  // DOM Elements
  const searchInput = document.getElementById('searchInput');
  const searchResults = document.getElementById('searchResults');
  const playerPlaceholder = document.getElementById('playerPlaceholder');
  
  const nowPlayingTitle = document.getElementById('nowPlayingTitle');
  const nowPlayingEpTag = document.getElementById('nowPlayingEpTag');
  const nowPlayingSubTag = document.getElementById('nowPlayingSubTag');
  
  const btnPrevEp = document.getElementById('btnPrevEp');
  const btnNextEp = document.getElementById('btnNextEp');
  
  const dramaPoster = document.getElementById('dramaPoster');
  const dramaTitle = document.getElementById('dramaTitle');
  const dramaCountry = document.getElementById('dramaCountry');
  const dramaStatus = document.getElementById('dramaStatus');
  const dramaEpCount = document.getElementById('dramaEpCount');
  
  const seasonSelector = document.getElementById('seasonSelector');
  const episodesGrid = document.getElementById('episodesGrid');
  const episodesTotalBadge = document.getElementById('episodesTotalBadge');

  // ── Init & Hash Router ──────────────────────────────────────────────────
  window.addEventListener('DOMContentLoaded', () => {
    setupSearch();
    setupNavigationButtons();
    handleHashNavigation();
  });

  window.addEventListener('hashchange', () => {
    handleHashNavigation();
  });

  async function handleHashNavigation() {
    const hash = window.location.hash.slice(1);
    const params = new URLSearchParams(hash);
    const dramaId = params.get('drama');
    const epId = params.get('ep');

    if (dramaId) {
      await loadDramaDetails(dramaId, epId);
    } else {
      // Default initial drama (Goblin)
      loadDramaDetails(26);
    }
  }

  // Helper to completely stop and clean up old player & audio elements (Ghost Audio Fix)
  function destroyCurrentPlayer() {
    if (art) {
      if (art.hls) {
        try { art.hls.destroy(); } catch (e) {}
      }
      if (art.video) {
        try {
          art.video.pause();
          art.video.removeAttribute('src');
          art.video.load();
        } catch (e) {}
      }
      try { art.destroy(true); } catch (e) {}
      art = null;
    }

    const container = document.getElementById('artplayer');
    if (container) {
      const oldVideos = container.querySelectorAll('video');
      oldVideos.forEach(v => {
        try {
          v.pause();
          v.removeAttribute('src');
          v.load();
          v.remove();
        } catch (e) {}
      });
      container.innerHTML = '';
    }
  }

  // ── Search Title (Strictly MAX 5 Results) ──────────────────────────────
  function setupSearch() {
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchDebounceTimer);
      const query = e.target.value.trim();

      if (!query) {
        searchResults.classList.add('hidden');
        searchResults.innerHTML = '';
        return;
      }

      searchDebounceTimer = setTimeout(() => {
        performSearch(query);
      }, 250);
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.search-container')) {
        searchResults.classList.add('hidden');
      }
    });
  }

  async function performSearch(query) {
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();

      if (!data.success || !data.results || data.results.length === 0) {
        searchResults.innerHTML = `<div class="search-result-item" style="color:var(--on-dark-muted); cursor:default;">No matching titles found.</div>`;
        searchResults.classList.remove('hidden');
        return;
      }

      // STRICT REQUIREMENT: Limit search results to MAX 5 items
      const limitedResults = data.results.slice(0, 5);

      searchResults.innerHTML = limitedResults.map(item => `
        <div class="search-result-item" data-id="${item.id}">
          <img src="${item.thumbnail || ''}" class="search-thumb" alt="${item.title}" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'36\' height=\'48\' fill=\'%231f1633\'%3E%3C/svg%3E'">
          <div class="search-info">
            <span class="title">${item.title}</span>
            <span class="subtext">${item.country || 'Drama'} • ${item.episodes_count || 1} Episodes</span>
          </div>
        </div>
      `).join('');

      searchResults.classList.remove('hidden');

      searchResults.querySelectorAll('.search-result-item').forEach(el => {
        el.addEventListener('click', () => {
          const dramaId = el.getAttribute('data-id');
          searchResults.classList.add('hidden');
          searchInput.value = '';

          // Stop previous audio playback immediately on drama switch
          destroyCurrentPlayer();
          window.location.hash = `drama=${dramaId}`;
        });
      });

    } catch (err) {
      console.error('Search error:', err);
    }
  }

  // ── Drama Details & Episode List ─────────────────────────────────────────
  async function loadDramaDetails(dramaId, targetEpId = null) {
    try {
      const res = await fetch(`/api/drama/${dramaId}`);
      const data = await res.json();

      if (!data.success || !data.drama) {
        alert('Failed to load drama details.');
        return;
      }

      currentDrama = data.drama;
      currentEpisodes = currentDrama.episodes || [];

      // Update UI Header & Meta
      dramaTitle.textContent = currentDrama.title;
      dramaCountry.textContent = currentDrama.country || 'Asian Drama';
      dramaStatus.textContent = currentDrama.status ? `Status: ${currentDrama.status}` : 'Completed';
      dramaEpCount.textContent = `${currentEpisodes.length} Episodes`;
      episodesTotalBadge.textContent = `${currentEpisodes.length} Total`;

      if (currentDrama.thumbnail) {
        dramaPoster.src = currentDrama.thumbnail;
      }

      // Render Season / Batch Filter & Episodes Grid
      renderEpisodesGrid(currentEpisodes);

      // Select target episode or default first episode
      let selectIdx = 0;
      if (targetEpId) {
        const found = currentEpisodes.findIndex(ep => String(ep.id) === String(targetEpId));
        if (found !== -1) selectIdx = found;
      }

      if (currentEpisodes.length > 0) {
        playEpisode(selectIdx);
      }

    } catch (err) {
      console.error('Failed to load drama:', err);
    }
  }

  // Render Episode Pills (supports Batching if > 35 episodes)
  function renderEpisodesGrid(episodes) {
    seasonSelector.innerHTML = '';
    
    if (episodes.length <= 35) {
      renderEpisodePills(episodes);
      return;
    }

    const chunkSize = 30;
    const chunkCount = Math.ceil(episodes.length / chunkSize);
    
    for (let i = 0; i < chunkCount; i++) {
      const start = i * chunkSize + 1;
      const end = Math.min((i + 1) * chunkSize, episodes.length);
      
      const btn = document.createElement('button');
      btn.className = `season-tab-btn ${i === 0 ? 'active' : ''}`;
      btn.textContent = `Ep ${start}-${end}`;
      btn.addEventListener('click', () => {
        seasonSelector.querySelectorAll('.season-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderEpisodePills(episodes.slice(i * chunkSize, (i + 1) * chunkSize));
      });
      seasonSelector.appendChild(btn);
    }

    renderEpisodePills(episodes.slice(0, chunkSize));
  }

  function renderEpisodePills(epList) {
    if (!epList || epList.length === 0) {
      episodesGrid.innerHTML = `<div class="empty-state">No episodes available.</div>`;
      return;
    }

    episodesGrid.innerHTML = epList.map(ep => {
      const globalIndex = currentEpisodes.findIndex(e => e.id === ep.id);
      return `
        <button class="ep-pill-btn ${globalIndex === currentEpIndex ? 'active' : ''}" data-index="${globalIndex}">
          EP ${ep.number}
        </button>
      `;
    }).join('');

    episodesGrid.querySelectorAll('.ep-pill-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-index'), 10);
        playEpisode(idx);
      });
    });
  }

  // ── Artplayer Stream Player ──────────────────────────────────────────────
  async function playEpisode(index) {
    if (index < 0 || index >= currentEpisodes.length || isPlayingLoading) return;

    isPlayingLoading = true;
    
    // Stop any existing player or lingering audio immediately!
    destroyCurrentPlayer();

    currentEpIndex = index;
    const ep = currentEpisodes[index];

    // Highlight active pill
    episodesGrid.querySelectorAll('.ep-pill-btn').forEach(btn => {
      const idx = parseInt(btn.getAttribute('data-index'), 10);
      btn.classList.toggle('active', idx === currentEpIndex);
    });

    // Update Nav Buttons State
    btnPrevEp.disabled = (currentEpIndex <= 0);
    btnNextEp.disabled = (currentEpIndex >= currentEpisodes.length - 1);

    nowPlayingTitle.textContent = `${currentDrama ? currentDrama.title : 'Drama'} — Ep ${ep.number}`;
    nowPlayingEpTag.textContent = `EPISODE ${ep.number}`;
    nowPlayingSubTag.textContent = `Resolving stream and WebVTT subtitles...`;

    // Update hash silently
    window.history.replaceState(null, '', `#drama=${currentDrama.id}&ep=${ep.id}`);

    try {
      const res = await fetch(`/api/episode/${ep.id}`);
      const data = await res.json();

      if (!data.success || !data.stream || !data.stream.url) {
        nowPlayingSubTag.textContent = `Failed to resolve stream for Episode ${ep.number}.`;
        isPlayingLoading = false;
        alert(`Stream resolution error: ${data.error || 'Unknown error'}`);
        return;
      }

      playerPlaceholder.classList.add('hidden');

      const streamUrl = data.stream.player_ready_url || data.stream.url;
      const subtitles = data.subtitles || [];
      const isHls = (data.stream.type === 'hls') || streamUrl.includes('.m3u8');

      nowPlayingSubTag.textContent = subtitles.length > 0 
        ? `Subtitles available: ${subtitles.map(s => s.label).join(', ')}` 
        : 'Subtitles: None available';

      const artOptions = {
        container: '#artplayer',
        url: streamUrl,
        type: isHls ? 'm3u8' : 'mp4',
        autoplay: false,
        setting: true,
        flip: true,
        playbackRate: true,
        aspectRatio: true,
        fullscreen: true,       // Native OS Fullscreen
        fullscreenWeb: false,   // Disables in-page web fullscreen option
        pip: true,
        miniProgressBar: true,
        autoPlayback: true,
        fastForward: true,
        controls: [
          {
            position: 'left',
            index: 10,
            html: ICONS.prev10s,
            tooltip: 'Rewind 10s',
            click: function () {
              if (art && art.video) art.video.currentTime = Math.max(0, art.video.currentTime - 10);
            }
          },
          {
            position: 'left',
            index: 11,
            html: ICONS.next10s,
            tooltip: 'Forward 10s',
            click: function () {
              if (art && art.video) art.video.currentTime = Math.min(art.video.duration || 0, art.video.currentTime + 10);
            }
          }
        ],
        settings: [
          {
            html: 'Subtitle Customization',
            tooltip: 'Appearance',
            selector: [
              {
                html: 'Font Size',
                tooltip: '20px',
                selector: [
                  { html: '16px (Small)', value: '16px' },
                  { html: '20px (Medium)', default: true, value: '20px' },
                  { html: '24px (Large)', value: '24px' },
                  { html: '28px (Extra Large)', value: '28px' }
                ],
                onSelect: function (item) {
                  if (art && art.subtitle) art.subtitle.style('fontSize', item.value);
                  return item.html;
                }
              },
              {
                html: 'Text Color',
                tooltip: 'White',
                selector: [
                  { html: 'White', default: true, value: '#ffffff' },
                  { html: 'Electric Lime', value: '#c2ef4e' },
                  { html: 'Yellow', value: '#ffeb3b' },
                  { html: 'Cyan', value: '#00e5ff' }
                ],
                onSelect: function (item) {
                  if (art && art.subtitle) art.subtitle.style('color', item.value);
                  return item.html;
                }
              },
              {
                html: 'Background',
                tooltip: 'Shadow',
                selector: [
                  { html: 'Text Shadow Only', default: true, value: 'shadow' },
                  { html: 'Translucent Dark Box', value: 'translucent' },
                  { html: 'Solid Black Box', value: 'solid' }
                ],
                onSelect: function (item) {
                  if (!art || !art.subtitle) return item.html;
                  if (item.value === 'shadow') {
                    art.subtitle.style('background', 'none');
                    art.subtitle.style('textShadow', '0 2px 4px rgba(0,0,0,0.9)');
                    art.subtitle.style('padding', '0');
                  } else if (item.value === 'translucent') {
                    art.subtitle.style('background', 'rgba(0, 0, 0, 0.75)');
                    art.subtitle.style('textShadow', 'none');
                    art.subtitle.style('padding', '4px 12px');
                    art.subtitle.style('borderRadius', '4px');
                  } else if (item.value === 'solid') {
                    art.subtitle.style('background', '#000000');
                    art.subtitle.style('textShadow', 'none');
                    art.subtitle.style('padding', '4px 12px');
                    art.subtitle.style('borderRadius', '4px');
                  }
                  return item.html;
                }
              }
            ]
          }
        ]
      };

      if (isHls) {
        artOptions.customType = {
          m3u8: function (video, url) {
            if (Hls.isSupported()) {
              if (art && art.hls) {
                try { art.hls.destroy(); } catch (e) {}
              }
              const hls = new Hls({
                maxBufferLength: 30,
                enableWorker: true
              });
              hls.loadSource(url);
              hls.attachMedia(video);
              if (art) art.hls = hls;
            } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
              video.src = url;
            }
          }
        };
      }

      if (subtitles.length > 0) {
        artOptions.subtitle = {
          url: subtitles[0].url,
          type: 'vtt',
          style: {
            color: '#ffffff',
            fontSize: '20px',
            fontFamily: "'Rubik', sans-serif",
            textShadow: '0 2px 4px rgba(0,0,0,0.9)'
          }
        };

        artOptions.subtitles = subtitles.map(s => ({
          html: s.label,
          url: s.url,
          default: s.default
        }));
      }

      art = new Artplayer(artOptions);

      // Explicitly remove webFullscreen control button so ONLY ONE native fullscreen button remains
      if (art && art.controls) {
        try { art.controls.remove('fullscreenWeb'); } catch (e) {}
      }

      // Auto Advance to Next Episode on Finish
      art.on('video:ended', () => {
        if (currentEpIndex < currentEpisodes.length - 1) {
          playEpisode(currentEpIndex + 1);
        }
      });

    } catch (err) {
      console.error('Play error:', err);
      nowPlayingSubTag.textContent = `Error playing episode: ${err.message}`;
    } finally {
      isPlayingLoading = false;
    }
  }

  // ── Navigation Buttons ──────────────────────────────────────────────────
  function setupNavigationButtons() {
    btnPrevEp.addEventListener('click', () => {
      if (currentEpIndex > 0) playEpisode(currentEpIndex - 1);
    });

    btnNextEp.addEventListener('click', () => {
      if (currentEpIndex < currentEpisodes.length - 1) playEpisode(currentEpIndex + 1);
    });
  }

})();
