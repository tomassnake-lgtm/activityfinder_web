(function () {
  'use strict';

  var supabase = null;
  var mapInstance = null;
  var mapMarkers = [];
  var adminMapInstance = null;
  var adminMapMarker = null;
  var STORAGE_BUCKET = 'activity_images';
  var CONSENT_KEY = 'af_consent_tos_analytics_v1';
  var THEME_KEY = 'af_color_theme';
  var weeklyTimerId = null;
  var weeklyIndex = 0;
  var WEEKLY_ROTATE_MS = 6000;
  var weeklySwipeBound = false;
  var weeklyPointerId = null;
  var weeklyStartX = 0;
  var weeklyActive = false;
  var weeklyLastDirection = 'next';

  var THEMES = ['snø', 'vann', 'skog', 'ball', 'sosial', 'familie', 'foreldrepermisjon'];
  var currentFilter = null;
  var searchQuery = '';
  var activeQuickFilters = new Set();
  /** «Alle aktiviteter»: begrens antall til Vis mer (kun liste, ikke kart) */
  var afActivitiesListExpanded = false;
  var LIST_CAP_MOBILE = 5;
  var LIST_CAP_DESKTOP = 14;

  function resetActivityListPagination() {
    afActivitiesListExpanded = false;
  }

  function getActivityListCap() {
    try {
      return window.matchMedia('(max-width: 768px)').matches ? LIST_CAP_MOBILE : LIST_CAP_DESKTOP;
    } catch (e) {
      return LIST_CAP_DESKTOP;
    }
  }

  function getSupabase() {
    if (supabase) return supabase;
    var url = String(window.SUPABASE_URL || '').trim();
    var key = String(window.SUPABASE_ANON_KEY || '').trim();
    if (!url || !key || url.indexOf('ditt-prosjekt') !== -1) {
      console.warn(
        'ActivityFinder: Mangler Supabase URL/anon-nøkkel. Lokalt: fyll website/config.js eller supabase-runtime.js. ' +
          'På Vercel: sett SUPABASE_URL og SUPABASE_ANON_KEY under Environment Variables og redeploy.'
      );
      return null;
    }
    if (typeof createClient === 'undefined') {
      console.warn('ActivityFinder: Supabase JS ikke lastet.');
      return null;
    }
    supabase = window.createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: window.localStorage,
        storageKey: 'activityfinder-web-auth'
      }
    });
    return supabase;
  }

  function showSection(sectionId) {
    var sections = ['af-page-home', 'af-page-profile', 'af-page-admin'];
    sections.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.classList.toggle('af-visible', id === sectionId);
    });
    if (sectionId === 'af-page-home' && mapInstance) mapInstance.invalidateSize();
  }

  function onHashChange() {
    var hash = (window.location.hash || '#').replace('#', '');
    if (hash === 'profile') showSection('af-page-profile');
    else if (hash === 'admin') showSection('af-page-admin');
    else showSection('af-page-home');
    if (document.getElementById('af-page-home').classList.contains('af-visible')) {
      var scrollId = (hash === 'weekly' || hash === 'activities' || hash === 'map') ? hash : 'hero';
      setTimeout(function () {
        var el = document.getElementById(scrollId);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 50);
    }
  }

  function renderAuthUI(session, profile) {
    var profileLink = document.getElementById('af-profile-link');
    var adminLink = document.getElementById('af-admin-link');
    var loggedIn = !!session;
    var isAdmin = profile && (profile.user_type === 'admin' || profile.user_type === 'activity_leader');
    if (profileLink) {
      profileLink.style.display = '';
      profileLink.textContent = loggedIn ? 'Profil' : 'Logg inn';
      profileLink.href = '#profile';
    }
    if (adminLink) {
      adminLink.style.display = loggedIn && isAdmin ? '' : 'none';
      adminLink.href = '#admin';
    }
  }

  function updateProfilePage(session, profile) {
    var loginBlock = document.getElementById('af-profile-login');
    var contentBlock = document.getElementById('af-profile-content');
    var nameEl = document.getElementById('af-profile-name');
    var emailEl = document.getElementById('af-profile-email');
    var loggedIn = !!session;
    if (loginBlock) loginBlock.style.display = loggedIn ? 'none' : '';
    if (contentBlock) contentBlock.style.display = loggedIn ? '' : 'none';
    if (nameEl) nameEl.textContent = (profile && profile.name) || (session && session.user && session.user.email) || '—';
    if (emailEl) emailEl.textContent = (session && session.user && session.user.email) || '—';
  }

  function initAuth(done) {
    var sb = getSupabase();
    if (!sb) {
      if (done) done();
      return;
    }
    sb.auth.onAuthStateChange(function (event, session) {
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        fetchProfileAndRender(session);
      }
    });
    sb.auth.getSession().then(function (r) {
      var session = r.data.session;
      fetchProfileAndRender(session);
      if (window.location.hash.indexOf('access_token') !== -1 || window.location.hash.indexOf('refresh_token') !== -1) {
        window.location.hash = 'profile';
      }
      if (done) done();
    }).catch(function () {
      if (done) done();
    });
  }

  function fetchProfileAndRender(session) {
    var sb = getSupabase();
    if (sb && session && session.user) {
      sb.from('user_profiles').select('name, user_type').eq('user_id', session.user.id).single()
        .then(function (res) {
          var profile = res.data || null;
          renderAuthUI(session, profile);
          updateProfilePage(session, profile);
          syncThemeForSession(session);
          if (window.location.hash === '#admin') loadAdminActivities();
        })
        .catch(function () {
          renderAuthUI(session, null);
          updateProfilePage(session, null);
          syncThemeForSession(session);
        });
    } else {
      renderAuthUI(null, null);
      updateProfilePage(null, null);
      syncThemeForSession(null);
    }
  }

  window.afLogin = function (email, password) {
    var sb = getSupabase();
    if (!sb) {
      return Promise.reject(new Error(
        'Supabase er ikke konfigurert (mangler URL/nøkkel). Sjekk supabase-runtime.js på server eller config.js lokalt.'
      ));
    }
    return sb.auth.signInWithPassword({ email: email, password: password });
  };

  window.afLoginGoogle = function () {
    var sb = getSupabase();
    if (!sb) {
      return Promise.reject(new Error(
        'Supabase er ikke konfigurert på denne adressen (mangler URL/nøkkel i nettleseren). ' +
        'På Vercel: sjekk at SUPABASE_URL og SUPABASE_ANON_KEY er satt og at siste deploy er grønn.'
      ));
    }
    var base = window.location.origin + window.location.pathname;
    var redirectTo = base.split('#')[0];
    return sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirectTo } });
  };

  window.afLogout = function () {
    var sb = getSupabase();
    if (sb) sb.auth.signOut();
    syncThemeForSession(null);
    window.location.hash = '';
    showSection('af-page-home');
  };

  function normalizeThemeMode(mode) {
    var m = String(mode || 'light').toLowerCase();
    return m === 'dark' ? 'dark' : 'light';
  }

  function syncThemeForSession(session) {
    var root = document.documentElement;
    if (!session) {
      root.setAttribute('data-theme', 'light');
      updateThemeButtons('light');
      return;
    }
    var pref = 'light';
    try {
      pref = window.localStorage.getItem(THEME_KEY) || 'light';
    } catch (e) {
      pref = 'light';
    }
    pref = normalizeThemeMode(pref);
    root.setAttribute('data-theme', pref);
    updateThemeButtons(pref);
  }

  function updateThemeButtons(mode) {
    var d = document.getElementById('af-theme-dark');
    var l = document.getElementById('af-theme-light');
    if (d) {
      d.setAttribute('aria-pressed', mode === 'dark' ? 'true' : 'false');
      d.classList.toggle('af-theme-btn-active', mode === 'dark');
    }
    if (l) {
      l.setAttribute('aria-pressed', mode === 'light' ? 'true' : 'false');
      l.classList.toggle('af-theme-btn-active', mode === 'light');
    }
  }

  function setLoggedInTheme(mode) {
    var m = normalizeThemeMode(mode);
    try {
      window.localStorage.setItem(THEME_KEY, m);
    } catch (e) {}
    document.documentElement.setAttribute('data-theme', m);
    updateThemeButtons(m);
  }

  function fetchActivities() {
    var sb = getSupabase();
    if (!sb) return Promise.resolve([]);
    return sb.from('activities').select('*').eq('status', 'active').then(function (r) {
      var list = r.error ? [] : (r.data || []);
      return list.filter(function (a) { return !isActivityPast(a); });
    });
  }

  function fetchWeeklyActivities() {
    var sb = getSupabase();
    if (!sb) return Promise.resolve([]);
    return sb.from('activities').select('*').eq('status', 'active').eq('is_weekly_featured', true)
      .then(function (r) { return r.error ? [] : (r.data || []).filter(function (a) { return !isActivityPast(a); }); });
  }

  /** Sjekker om aktiviteten allerede har vært (skal ikke vises i listen). */
  function isActivityPast(a) {
    var type = (a.activity_type || 'event');
    if (type === 'event') {
      var ed = a.event_date;
      if (!ed) return false;
      var d = new Date(ed);
      if (a.event_time) {
        var parts = String(a.event_time).match(/(\d{1,2}):(\d{2})/);
        if (parts) { d.setHours(parseInt(parts[1], 10), parseInt(parts[2], 10), 0, 0); }
      }
      return d.getTime() < Date.now();
    }
    if (type === 'period') {
      var end = a.period_end;
      if (end == null || end === '') return false;
      var endDate = new Date(end);
      endDate.setHours(23, 59, 59, 999);
      return endDate.getTime() < Date.now();
    }
    return false;
  }

  /** Kort beskrivelse på kort: ca. to setninger eller max 200 tegn; avkuttet tekst ender med ….
   * Full beskrivelse vises når man klikker inn på aktiviteten. */
  var SHORT_DESC_MAX_LEN = 200;
  function shortDescription(desc) {
    if (!desc || !desc.trim()) return '';
    var s = desc.trim();
    var idx = s.indexOf('. ');
    var out;
    if (idx !== -1) {
      var next = s.indexOf('. ', idx + 1);
      if (next !== -1) out = s.slice(0, next + 1).trim();
      else out = s.slice(0, idx + 1).trim();
    } else {
      out = s;
    }
    if (out.length > SHORT_DESC_MAX_LEN) out = out.slice(0, SHORT_DESC_MAX_LEN).trim();
    var truncated = out.length < s.length || (out.length === SHORT_DESC_MAX_LEN && s.length > SHORT_DESC_MAX_LEN);
    return truncated ? out + '…' : out;
  }

  function formatTimePlace(a) {
    var parts = [];
    var type = (a.activity_type || 'event');
    if (type === 'event' && a.event_date) {
      var d = new Date(a.event_date);
      parts.push(d.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' }));
      if (a.event_time) parts.push(a.event_time);
    } else if (type === 'period') {
      if (a.period_start) {
        var start = new Date(a.period_start);
        parts.push('Fra ' + start.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' }));
      }
      if (a.period_end) {
        var end = new Date(a.period_end);
        parts.push('til ' + end.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' }));
      } else if (a.period_start) parts.push('(uendelig)');
    }
    var loc = a.default_location || a.location;
    if (loc) parts.push(loc);
    return parts.length ? parts.join(' · ') : (loc || '');
  }

  function formatPrice(a) {
    var p = a.default_price;
    if (p == null || p === '' || isNaN(parseFloat(p))) return '';
    var n = parseFloat(p);
    if (n === 0) return 'Gratis';
    return 'Betalt';
  }

  function escapeHtml(s) {
    var div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  function escapeAttr(s) {
    return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function getTagLabel(tag) {
    var labels = {
      'gratis': 'Gratis',
      'familie': 'Familie',
      'barn': 'Barn',
      'utendors': 'Utendørs',
      'innendors': 'Innendørs',
      'sosial': 'Sosialt',
      'sport': 'Sport',
      'kultur': 'Kultur',
      'natur': 'Natur',
      'trening': 'Trening',
      'foreldrepermisjon': 'Foreldrepermisjon',
      'helg': 'Helg',
      'kveld': 'Kveld'
    };
    return labels[tag] || tag;
  }

  function showActivityModal(activity) {
    var overlay = document.getElementById('af-modal-overlay');
    var content = document.getElementById('af-modal-content');
    var modalBox = overlay ? overlay.querySelector('.af-modal') : null;
    if (!overlay || !content) return;
    var timePlace = formatTimePlace(activity);
    var price = formatPrice(activity);
    
    // Build tags HTML (only shown in modal)
    var tagsHtml = '';
    var tags = activity.tags || [];
    if (tags.length > 0) {
      tagsHtml = '<div class="af-modal-tags">';
      tags.forEach(function (tag) {
        tagsHtml += '<span class="af-modal-tag">' + escapeHtml(getTagLabel(tag)) + '</span>';
      });
      tagsHtml += '</div>';
    }
    
    content.innerHTML =
      (activity.custom_photo_url ? '<img src="' + escapeAttr(activity.custom_photo_url) + '" alt="" class="af-modal-img" />' : '') +
      '<h3 class="af-modal-activity-title">' + escapeHtml(activity.name || '') + '</h3>' +
      (activity.category ? '<p class="af-modal-meta">' + escapeHtml(activity.category) + '</p>' : '') +
      tagsHtml +
      (timePlace ? '<p class="af-modal-time-place">' + escapeHtml(timePlace) + '</p>' : '') +
      (price ? '<p class="af-modal-price">' + escapeHtml(price) + '</p>' : '') +
      '<p class="af-modal-desc">' + escapeHtml(activity.description || activity.short_description || '') + '</p>' +
      ((activity.default_location || activity.location) && !timePlace ? '<p class="af-modal-loc">' + escapeHtml(activity.default_location || activity.location) + '</p>' : '') +
      (activity.external_url ? '<a href="' + escapeAttr(activity.external_url) + '" target="_blank" rel="noopener" class="af-button primary">Gå til nettside</a>' : '');
    overlay.classList.add('af-visible');
    overlay.onclick = function (e) {
      if (e.target === overlay) overlay.classList.remove('af-visible');
    };
    if (modalBox) modalBox.onclick = function (e) { e.stopPropagation(); };
  }

  function stopWeeklyRotation() {
    if (weeklyTimerId) {
      clearInterval(weeklyTimerId);
      weeklyTimerId = null;
    }
  }

  function renderWeeklySlide(container, activities, idx, direction) {
    var a = activities[idx];
    container.innerHTML = '';
    var card = document.createElement('article');
    var dir = direction === 'prev' ? 'prev' : 'next';
    weeklyLastDirection = dir;
    card.className =
      'af-weekly-card af-weekly-card-single ' +
      (dir === 'prev' ? 'af-weekly-from-left' : 'af-weekly-from-right');
    var img = (a.custom_photo_url && '<img src="' + escapeAttr(a.custom_photo_url) + '" alt="" class="af-weekly-img" />') || '';
    var desc = (a.short_description && a.short_description.trim()) ? a.short_description.trim() : (a.description || '');
    var short = (desc || '').slice(0, 120);
    card.innerHTML =
      img +
      '<h3>' + escapeHtml(a.name || '') + '</h3>' +
      '<p>' + escapeHtml(short) + ((desc || '').length > 120 ? '…' : '') + '</p>';
    card.addEventListener('click', function (e) {
      showActivityModal(a);
    });
    container.appendChild(card);
    // Trigger animation
    requestAnimationFrame(function () {
      card.classList.add('af-weekly-in');
    });
  }

  function bindWeeklySwipe(container, activities) {
    if (weeklySwipeBound) return;
    weeklySwipeBound = true;

    function next() {
      if (!activities.length) return;
      stopWeeklyRotation();
      weeklyIndex = (weeklyIndex + 1) % activities.length;
      renderWeeklySlide(container, activities, weeklyIndex, 'next');
      startWeeklyRotation(container, activities);
    }

    function prev() {
      if (!activities.length) return;
      stopWeeklyRotation();
      weeklyIndex = (weeklyIndex - 1 + activities.length) % activities.length;
      renderWeeklySlide(container, activities, weeklyIndex, 'prev');
      startWeeklyRotation(container, activities);
    }

    container.addEventListener('pointerdown', function (e) {
      if (!activities.length) return;
      weeklyActive = true;
      weeklyPointerId = e.pointerId;
      weeklyStartX = e.clientX;
      try { container.setPointerCapture(weeklyPointerId); } catch (err) {}
      stopWeeklyRotation();
    });

    container.addEventListener('pointerup', function (e) {
      if (!weeklyActive) return;
      if (weeklyPointerId !== null && e.pointerId !== weeklyPointerId) return;
      weeklyActive = false;
      var dx = e.clientX - weeklyStartX;
      weeklyPointerId = null;
      if (Math.abs(dx) < 40) {
        startWeeklyRotation(container, activities);
        return;
      }
      if (dx < 0) next();
      else prev();
    });

    container.addEventListener('pointercancel', function () {
      weeklyActive = false;
      weeklyPointerId = null;
      startWeeklyRotation(container, activities);
    });
  }

  function startWeeklyRotation(container, activities) {
    stopWeeklyRotation();
    if (activities.length <= 1) return;
    weeklyTimerId = setInterval(function () {
      weeklyIndex = (weeklyIndex + 1) % activities.length;
      renderWeeklySlide(container, activities, weeklyIndex, 'next');
    }, WEEKLY_ROTATE_MS);
  }

  function renderWeeklyCarousel(activities) {
    var container = document.getElementById('af-weekly-carousel');
    if (!container) return;
    stopWeeklyRotation();
    container.innerHTML = '';

    if (!activities.length) {
      container.innerHTML = '<p class="af-empty">Ingen ukens aktiviteter lagt inn.</p>';
      return;
    }

    weeklyIndex = 0;
    renderWeeklySlide(container, activities, weeklyIndex, 'next');

    bindWeeklySwipe(container, activities);
    startWeeklyRotation(container, activities);
  }

  function renderActivityList(activities) {
    var container = document.getElementById('af-activities-list');
    if (!container) return;
    container.innerHTML = '';
    
    // Apply category filter
    var filtered = currentFilter
      ? activities.filter(function (a) { return (a.category || '').toLowerCase() === currentFilter; })
      : activities;
    
    // Apply search filter
    if (searchQuery) {
      var q = searchQuery.toLowerCase();
      filtered = filtered.filter(function (a) {
        return (a.name || '').toLowerCase().indexOf(q) !== -1 ||
               (a.description || '').toLowerCase().indexOf(q) !== -1 ||
               (a.short_description || '').toLowerCase().indexOf(q) !== -1 ||
               (a.category || '').toLowerCase().indexOf(q) !== -1 ||
               (a.default_location || a.location || '').toLowerCase().indexOf(q) !== -1;
      });
    }
    
    // Apply quick filters
    if (activeQuickFilters.size > 0) {
      filtered = filtered.filter(function (a) {
        var tags = a.tags || [];
        var price = a.default_price || 0;
        var category = (a.category || '').toLowerCase();
        var activityDate = a.event_date ? new Date(a.event_date) : null;
        var today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // Price filter
        if (activeQuickFilters.has('gratis') && price > 0) return false;
        
        // Family/children filters
        if (activeQuickFilters.has('familie') && tags.indexOf('familie') === -1 && category !== 'familie') return false;
        if (activeQuickFilters.has('barn') && tags.indexOf('barn') === -1) return false;
        
        // Location type filters
        if (activeQuickFilters.has('utendors') && tags.indexOf('utendors') === -1 && category !== 'utendørs') return false;
        if (activeQuickFilters.has('innendors') && tags.indexOf('innendors') === -1) return false;
        
        // Social filter
        if (activeQuickFilters.has('sosial') && tags.indexOf('sosial') === -1 && category !== 'sosial') return false;
        
        // Time filters
        if (activeQuickFilters.has('idag') && activityDate) {
          var todayEnd = new Date(today); todayEnd.setHours(23, 59, 59, 999);
          if (activityDate < today || activityDate > todayEnd) return false;
        }
        if (activeQuickFilters.has('denneuken') && activityDate) {
          var weekEnd = new Date(today); weekEnd.setDate(today.getDate() + 7);
          if (activityDate < today || activityDate > weekEnd) return false;
        }
        if (activeQuickFilters.has('helg') && activityDate) {
          var dayOfWeek = activityDate.getDay();
          if (dayOfWeek !== 0 && dayOfWeek !== 6) return false;
        }
        if (activeQuickFilters.has('kveld') && a.event_time) {
          var timeParts = a.event_time.match(/(\d+):?/);
          if (timeParts && parseInt(timeParts[1]) < 17) return false;
        }
        
        // Category filters
        if (activeQuickFilters.has('sport') && category !== 'sport' && category !== 'ball' && tags.indexOf('sport') === -1) return false;
        if (activeQuickFilters.has('kultur') && category !== 'kultur' && tags.indexOf('kultur') === -1) return false;
        if (activeQuickFilters.has('natur') && category !== 'natur' && category !== 'skog' && tags.indexOf('natur') === -1) return false;
        if (activeQuickFilters.has('trening') && category !== 'trening' && tags.indexOf('trening') === -1) return false;
        
        return true;
      });
    }
    
    if (!filtered.length) {
      container.innerHTML = '<p class="af-empty">Ingen aktiviteter matcher søket.</p>';
      return;
    }

    var cap = getActivityListCap();
    var showMore = !afActivitiesListExpanded && filtered.length > cap;
    var toRender = showMore ? filtered.slice(0, cap) : filtered;

    toRender.forEach(function (a) {
      var card = document.createElement('article');
      card.className = 'af-activity-card';
      var timePlace = formatTimePlace(a);
      var price = formatPrice(a);
      var bgStyle = (a.custom_photo_url ? 'background-image:url(' + escapeAttr(a.custom_photo_url) + ');' : '');
      card.setAttribute('style', bgStyle);
      card.innerHTML =
        '<div class="af-activity-card-overlay"></div>' +
        '<div class="af-activity-card-content">' +
        '<h3 class="af-activity-card-title">' + escapeHtml(a.name || '') + '</h3>' +
        '<p class="af-activity-card-desc">' + escapeHtml((a.short_description && a.short_description.trim()) ? a.short_description.trim() : shortDescription(a.description)) + '</p>' +
        (timePlace ? '<p class="af-activity-card-time">' + escapeHtml(timePlace) + '</p>' : '') +
        (price ? '<p class="af-activity-card-price">' + escapeHtml(price) + '</p>' : '') +
        (a.external_url ? '<a href="' + escapeAttr(a.external_url) + '" target="_blank" rel="noopener" class="af-card-link">Gå til nettside</a>' : '') +
        '</div>';
      card.addEventListener('click', function (e) {
        if (!e.target.closest('a')) showActivityModal(a);
      });
      container.appendChild(card);
    });

    if (showMore) {
      var wrap = document.createElement('div');
      wrap.className = 'af-activities-more-wrap';
      var moreBtn = document.createElement('button');
      moreBtn.type = 'button';
      moreBtn.className = 'af-button secondary af-activities-more-btn';
      moreBtn.textContent = 'Vis mer';
      moreBtn.addEventListener('click', function () {
        afActivitiesListExpanded = true;
        renderActivityList(activities);
      });
      wrap.appendChild(moreBtn);
      container.appendChild(wrap);
    }
  }

  function renderFilterChips() {
    var container = document.getElementById('af-filter-chips');
    if (!container) return;
    container.innerHTML = '<button type="button" class="af-chip af-chip-active" data-filter="">Alle</button>';
    var alleChip = container.firstElementChild;
    if (alleChip) {
      alleChip.addEventListener('click', function () {
        currentFilter = null;
        container.querySelectorAll('.af-chip').forEach(function (c) {
          c.classList.toggle('af-chip-active', (c.dataset.filter || '') === '');
        });
        resetActivityListPagination();
        if (window.afAllActivities) renderActivityList(window.afAllActivities);
      });
    }
    THEMES.forEach(function (t) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'af-chip';
      btn.dataset.filter = t;
      btn.textContent = t.charAt(0).toUpperCase() + t.slice(1);
      btn.addEventListener('click', function () {
        currentFilter = btn.dataset.filter || null;
        container.querySelectorAll('.af-chip').forEach(function (c) {
          c.classList.toggle('af-chip-active', (c.dataset.filter || '') === (currentFilter || ''));
        });
        resetActivityListPagination();
        if (window.afAllActivities) renderActivityList(window.afAllActivities);
      });
      container.appendChild(btn);
    });
  }

  function initMap(activities) {
    var container = document.getElementById('af-map');
    if (!container) return;
    if (mapInstance && mapMarkers.length) {
      mapMarkers.forEach(function (m) { m.remove(); });
      mapMarkers = [];
    }
    if (typeof L === 'undefined') return;
    if (!mapInstance) {
      mapInstance = L.map('af-map').setView([59.434, 10.658], 12);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      }).addTo(mapInstance);
    }
    var withCoords = activities.filter(function (a) {
      if (a.default_latitude != null && a.default_longitude != null) return true;
      if (a.default_coords && typeof a.default_coords === 'object') {
        a.default_latitude = a.default_coords.y;
        a.default_longitude = a.default_coords.x;
        return true;
      }
      return false;
    });
    withCoords.forEach(function (a) {
      var lat = a.default_latitude;
      var lng = a.default_longitude;
      var marker = L.marker([lat, lng]).addTo(mapInstance);
      marker.bindPopup(
        '<strong>' + escapeHtml(a.name || '') + '</strong><br>' +
        (a.description ? escapeHtml(shortDescription(a.description)) + '<br>' : '') +
        '<em>Klikk for mer info</em>' +
        (a.external_url ? '<br><a href="' + escapeAttr(a.external_url) + '" target="_blank">Les mer</a>' : '')
      );
      marker.on('click', function () { showActivityModal(a); });
      mapMarkers.push(marker);
    });
    if (withCoords.length > 0 && withCoords.length <= 30) {
      var bounds = L.latLngBounds(withCoords.map(function (a) {
        return [a.default_latitude, a.default_longitude];
      }));
      mapInstance.fitBounds(bounds, { padding: [20, 20] });
    }
  }

  function destroyAdminMap() {
    if (adminMapMarker) {
      adminMapMarker.remove();
      adminMapMarker = null;
    }
    if (adminMapInstance) {
      adminMapInstance.remove();
      adminMapInstance = null;
    }
  }

  function initAdminMap(lat, lng) {
    var container = document.getElementById('af-admin-map');
    if (!container || typeof L === 'undefined') return;
    destroyAdminMap();
    var latNum = lat != null && !isNaN(lat) ? parseFloat(lat) : 59.434;
    var lngNum = lng != null && !isNaN(lng) ? parseFloat(lng) : 10.658;
    adminMapInstance = L.map('af-admin-map').setView([latNum, lngNum], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(adminMapInstance);
    if (lat != null && lng != null && !isNaN(lat) && !isNaN(lng)) {
      adminMapMarker = L.marker([latNum, lngNum]).addTo(adminMapInstance);
    }
    adminMapInstance.on('click', function (e) {
      if (adminMapMarker) adminMapMarker.remove();
      adminMapMarker = L.marker(e.latlng).addTo(adminMapInstance);
      document.getElementById('af-admin-lat').value = e.latlng.lat.toFixed(5);
      document.getElementById('af-admin-lng').value = e.latlng.lng.toFixed(5);
    });
  }

  function loadPublicData() {
    Promise.all([fetchWeeklyActivities(), fetchActivities()]).then(function (results) {
      var weekly = results[0];
      var all = results[1];
      window.afAllActivities = all;
      renderWeeklyCarousel(weekly);
      renderActivityList(all);
      renderFilterChips();
      initMap(all);
    });
  }

  function loadAdminActivities() {
    var sb = getSupabase();
    if (!sb) return;
    sb.auth.getSession().then(function (r) {
      var session = r.data.session;
      if (!session) return;
      return sb.from('activities').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false });
    }).then(function (res) {
      if (!res) return;
      var list = document.getElementById('af-admin-list');
      if (!list) return;
      var activities = res.data || [];
      list.innerHTML = '';
      if (!activities.length) {
        list.innerHTML = '<p class="af-empty">Du har ikke opprettet noen aktiviteter ennå.</p>';
        return;
      }
      activities.forEach(function (a) {
        var row = document.createElement('div');
        row.className = 'af-admin-row';
        row.innerHTML =
          '<span class="af-admin-row-name">' + escapeHtml(a.name || '') + '</span>' +
          '<span class="af-admin-row-status">' + (a.status || '') + '</span>' +
          '<button type="button" class="af-button secondary af-admin-edit" data-id="' + escapeAttr(a.id) + '">Rediger</button>';
        row.querySelector('.af-admin-edit').addEventListener('click', function () { openAdminForm(a); });
        list.appendChild(row);
      });
    }).catch(function () {});
  }

  function openAdminForm(activity) {
    setAdminPhotoStatus('');
    var form = document.getElementById('af-admin-form');
    var idField = document.getElementById('af-admin-id');
    if (!form || !idField) return;
    if (activity) {
      idField.value = activity.id;
      document.getElementById('af-admin-name').value = activity.name || '';
      document.getElementById('af-admin-short-description').value = activity.short_description || '';
      document.getElementById('af-admin-description').value = activity.description || '';
      document.getElementById('af-admin-category').value = activity.category || '';
      document.getElementById('af-admin-location').value = activity.default_location || activity.location || '';
      document.getElementById('af-admin-lat').value = activity.default_latitude != null ? activity.default_latitude : '';
      document.getElementById('af-admin-lng').value = activity.default_longitude != null ? activity.default_longitude : '';
      document.getElementById('af-admin-photo').value = activity.custom_photo_url || '';
      document.getElementById('af-admin-url').value = activity.external_url || '';
      // Prisvalg: 0 = gratis, >0 = betalt
      var isFree = !activity.default_price || parseFloat(activity.default_price) === 0;
      document.getElementById('af-admin-price-free').checked = isFree;
      document.getElementById('af-admin-price-paid').checked = !isFree;
      document.getElementById('af-admin-weekly').checked = !!activity.is_weekly_featured;
      document.getElementById('af-admin-status').value = activity.status || 'active';
      var type = activity.activity_type || 'event';
      document.getElementById('af-admin-type-event').checked = type === 'event';
      document.getElementById('af-admin-type-period').checked = type === 'period';
      document.getElementById('af-admin-event-date').value = activity.event_date || '';
      document.getElementById('af-admin-event-time').value = activity.event_time || '';
      document.getElementById('af-admin-period-start').value = activity.period_start || '';
      document.getElementById('af-admin-period-end').value = activity.period_end || '';
      var infinite = !activity.period_end;
      document.getElementById('af-admin-period-infinite').checked = infinite;
      document.getElementById('af-admin-period-end').disabled = infinite;
      toggleAdminTypeFields();
      // Set tags
      var activityTags = activity.tags || [];
      document.querySelectorAll('input[name="af-tags"]').forEach(function (cb) {
        cb.checked = activityTags.indexOf(cb.value) !== -1;
      });
      form.querySelector('.af-admin-form-title').textContent = 'Rediger aktivitet';
    } else {
      idField.value = '';
      document.getElementById('af-admin-name').value = '';
      document.getElementById('af-admin-short-description').value = '';
      document.getElementById('af-admin-description').value = '';
      document.getElementById('af-admin-category').value = '';
      document.getElementById('af-admin-location').value = '';
      document.getElementById('af-admin-lat').value = '';
      document.getElementById('af-admin-lng').value = '';
      document.getElementById('af-admin-photo').value = '';
      var photoFileInput = document.getElementById('af-admin-photo-file');
      if (photoFileInput) photoFileInput.value = '';
      document.getElementById('af-admin-url').value = '';
      document.getElementById('af-admin-price-free').checked = true;
      document.getElementById('af-admin-price-paid').checked = false;
      document.getElementById('af-admin-status').value = 'active';
      document.getElementById('af-admin-weekly').checked = false;
      document.getElementById('af-admin-type-event').checked = true;
      document.getElementById('af-admin-type-period').checked = false;
      document.getElementById('af-admin-event-date').value = '';
      document.getElementById('af-admin-event-time').value = '';
      document.getElementById('af-admin-period-start').value = '';
      document.getElementById('af-admin-period-end').value = '';
      document.getElementById('af-admin-period-infinite').checked = false;
      document.getElementById('af-admin-period-end').disabled = false;
      toggleAdminTypeFields();
      // Clear tags
      document.querySelectorAll('input[name="af-tags"]').forEach(function (cb) {
        cb.checked = false;
      });
      form.querySelector('.af-admin-form-title').textContent = 'Ny aktivitet';
    }
    form.classList.add('af-visible');
    setTimeout(function () {
      var lat = document.getElementById('af-admin-lat').value;
      var lng = document.getElementById('af-admin-lng').value;
      initAdminMap(lat || null, lng || null);
    }, 200);
  }

  function toggleAdminTypeFields() {
    var isEvent = document.getElementById('af-admin-type-event')?.checked;
    var eventFields = document.getElementById('af-admin-event-fields');
    var periodFields = document.getElementById('af-admin-period-fields');
    if (eventFields) eventFields.style.display = isEvent ? '' : 'none';
    if (periodFields) periodFields.style.display = isEvent ? 'none' : '';
    var inf = document.getElementById('af-admin-period-infinite');
    var endEl = document.getElementById('af-admin-period-end');
    if (endEl) endEl.disabled = inf ? inf.checked : false;
    if (inf && inf.checked && endEl) endEl.value = '';
  }

  window.afAdminNew = function () { openAdminForm(null); };
  window.afAdminCloseForm = function () {
    destroyAdminMap();
    var form = document.getElementById('af-admin-form');
    if (form) form.classList.remove('af-visible');
  };

  function setAdminPhotoStatus(msg, isError) {
    var el = document.getElementById('af-admin-photo-status');
    if (el) {
      el.textContent = msg || '';
      el.style.color = isError ? 'var(--af-error, #e11)' : 'var(--af-accent)';
    }
  }

  function handleAdminPhotoUpload(file) {
    var sb = getSupabase();
    if (!sb) {
      setAdminPhotoStatus('Supabase er ikke konfigurert.', true);
      return;
    }
    if (!file || !file.size) {
      setAdminPhotoStatus('', false);
      return;
    }
    setAdminPhotoStatus('Laster opp…', false);
    sb.auth.getSession().then(function (r) {
      var session = r.data.session;
      if (!session) {
        setAdminPhotoStatus('Du må være innlogget for å laste opp.', true);
        return;
      }
      var ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!ext) ext = 'jpg';
      var path = session.user.id + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 10) + '.' + ext;
      return sb.storage.from(STORAGE_BUCKET).upload(path, file, { upsert: false }).then(function (uploadRes) {
        if (uploadRes.error) throw uploadRes.error;
        var publicUrl = sb.storage.from(STORAGE_BUCKET).getPublicUrl(path).data.publicUrl;
        document.getElementById('af-admin-photo').value = publicUrl;
        setAdminPhotoStatus('Bilde lastet opp. URL er satt.');
      });
    }).catch(function (err) {
      var msg = err.message || '';
      if (msg.indexOf('Bucket not found') !== -1 || msg.indexOf('bucket') !== -1) {
        setAdminPhotoStatus('Bucket activity_images finnes ikke. Opprett den i Supabase: Storage → New bucket, navn: activity_images (underscore), Public. Se SUPABASE-SETUP.md punkt 6.', true);
      } else {
        setAdminPhotoStatus('Feil ved opplasting: ' + (msg || 'prøv igjen'), true);
      }
    });
  }

  window.afAdminSave = function () {
    var sb = getSupabase();
    if (!sb) return;
    var idEl = document.getElementById('af-admin-id');
    var id = (idEl && idEl.value) || '';
    var type = document.getElementById('af-admin-type-period')?.checked ? 'period' : 'event';
    var periodEndEl = document.getElementById('af-admin-period-end');
    var periodEnd = (document.getElementById('af-admin-period-infinite')?.checked || !periodEndEl || periodEndEl.disabled)
      ? null
      : (periodEndEl.value.trim() || null);
    var locationVal = document.getElementById('af-admin-location').value.trim() || '';
    var eventDateVal = type === 'event' ? (document.getElementById('af-admin-event-date').value.trim() || null) : null;
    var periodStartVal = type === 'period' ? (document.getElementById('af-admin-period-start').value.trim() || null) : null;
    var dateForDb = eventDateVal || periodStartVal;
    if (!dateForDb) {
      var today = new Date();
      dateForDb = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
    }
    // Collect selected tags
    var selectedTags = [];
    document.querySelectorAll('input[name="af-tags"]:checked').forEach(function (cb) {
      selectedTags.push(cb.value);
    });
    
    // Pris: velg mellom gratis eller betalt
    var isFree = document.getElementById('af-admin-price-free').checked;
    var priceVal = isFree ? 0 : 1;
    if (priceVal === 0 && selectedTags.indexOf('gratis') === -1) {
      selectedTags.push('gratis');
    }
    
    var payload = {
      name: document.getElementById('af-admin-name').value.trim(),
      short_description: document.getElementById('af-admin-short-description').value.trim() || null,
      description: document.getElementById('af-admin-description').value.trim() || null,
      category: document.getElementById('af-admin-category').value.trim() || null,
      location: locationVal,
      default_location: locationVal || null,
      default_latitude: parseFloat(document.getElementById('af-admin-lat').value) || null,
      default_longitude: parseFloat(document.getElementById('af-admin-lng').value) || null,
      custom_photo_url: document.getElementById('af-admin-photo').value.trim() || null,
      external_url: document.getElementById('af-admin-url').value.trim() || null,
      default_price: priceVal,
      is_weekly_featured: document.getElementById('af-admin-weekly').checked,
      status: document.getElementById('af-admin-status').value || 'active',
      date: dateForDb,
      activity_type: type,
      event_date: type === 'event' ? eventDateVal : null,
      event_time: type === 'event' ? (document.getElementById('af-admin-event-time').value.trim() || null) : null,
      period_start: type === 'period' ? periodStartVal : null,
      period_end: type === 'period' ? periodEnd : null,
      tags: selectedTags
    };
    if (!payload.name) { alert('Navn er påkrevd.'); return; }
    sb.auth.getSession().then(function (r) {
      var session = r.data.session;
      if (!session) { alert('Du må være innlogget.'); return; }
      payload.user_id = session.user.id;
      if (id) {
        return sb.from('activities').update(payload).eq('id', id).eq('user_id', session.user.id).select();
      } else {
        return sb.from('activities').insert(payload).select();
      }
    }).then(function (res) {
      if (!res) return;
      if (res.error) {
        var msg = res.error.message || 'Kunne ikke lagre';
        if (
          msg.indexOf("Could not find the 'short_description' column of 'activities'") !== -1 ||
          msg.indexOf("short_description") !== -1 && msg.indexOf("schema cache") !== -1
        ) {
          alert(
            'Feil: short_description-kolonnen mangler i Supabase-tabellen activities.\n\n' +
            'Løsning: Kjør denne SQL-en i Supabase (SQL Editor):\n' +
            "ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS short_description text;\n\n" +
            'Hvis feilen fortsatt kommer etterpå: gå til Database → Tables → activities og trykk “Refresh schema cache” (evt. vent litt og prøv igjen).'
          );
          return;
        }
        alert('Feil: ' + msg);
        return;
      }
      window.afAdminCloseForm();
      loadAdminActivities();
      loadPublicData();
    });
  };

  function initAdmin() {
    var newBtn = document.getElementById('af-admin-new');
    if (newBtn) newBtn.addEventListener('click', function () { openAdminForm(null); });
    document.getElementById('af-admin-close')?.addEventListener('click', window.afAdminCloseForm);
    document.getElementById('af-admin-form-close')?.addEventListener('click', window.afAdminCloseForm);
    document.getElementById('af-admin-save')?.addEventListener('click', window.afAdminSave);
    var photoFile = document.getElementById('af-admin-photo-file');
    if (photoFile) photoFile.addEventListener('change', function () {
      if (photoFile.files && photoFile.files[0]) handleAdminPhotoUpload(photoFile.files[0]);
    });
    var adminFormOverlay = document.getElementById('af-admin-form');
    if (adminFormOverlay) {
      adminFormOverlay.addEventListener('click', function (e) {
        if (e.target === adminFormOverlay) window.afAdminCloseForm();
      });
      var adminFormBox = adminFormOverlay.querySelector('.af-modal');
      if (adminFormBox) adminFormBox.addEventListener('click', function (e) { e.stopPropagation(); });
    }
    document.querySelectorAll('input[name="af-admin-activity-type"]').forEach(function (radio) {
      radio.addEventListener('change', toggleAdminTypeFields);
    });
    document.getElementById('af-admin-period-infinite')?.addEventListener('change', toggleAdminTypeFields);
    if (window.location.hash === '#admin') loadAdminActivities();
  }

  function setupSearchAndFilters() {
    // Search input
    var searchInput = document.getElementById('af-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', function (e) {
        searchQuery = e.target.value.trim();
        resetActivityListPagination();
        if (window.afAllActivities) renderActivityList(window.afAllActivities);
      });
    }
    
    // Quick filters (both in main area and expanded)
    document.querySelectorAll('.af-quick-filter').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var filter = btn.dataset.filter;
        if (activeQuickFilters.has(filter)) {
          activeQuickFilters.delete(filter);
          btn.classList.remove('af-quick-filter-active');
        } else {
          activeQuickFilters.add(filter);
          btn.classList.add('af-quick-filter-active');
        }
        resetActivityListPagination();
        if (window.afAllActivities) renderActivityList(window.afAllActivities);
      });
    });
    
    // Filter toggle (icon button)
    var filterToggle = document.getElementById('af-filter-toggle');
    var expandedFilters = document.getElementById('af-expanded-filters');
    if (filterToggle && expandedFilters) {
      filterToggle.addEventListener('click', function () {
        var isHidden = expandedFilters.classList.contains('af-filter-hidden');
        expandedFilters.classList.toggle('af-filter-hidden', !isHidden);
        filterToggle.classList.toggle('af-active', isHidden);
      });
    }
  }

  function init() {
    document.documentElement.setAttribute('data-theme', 'light');
    document.getElementById('year').textContent = new Date().getFullYear();
    window.addEventListener('hashchange', onHashChange);
    setupSearchAndFilters();

    var afResizeListTimer = null;
    window.addEventListener('resize', function () {
      clearTimeout(afResizeListTimer);
      afResizeListTimer = setTimeout(function () {
        if (window.afAllActivities) renderActivityList(window.afAllActivities);
      }, 200);
    });

    // Consent modal (TOS + anonymized analytics)
    (function initConsent() {
      var overlay = document.getElementById('af-consent-overlay');
      var acceptBtn = document.getElementById('af-consent-accept');
      if (!overlay || !acceptBtn) return;
      var accepted = false;
      try {
        accepted = window.localStorage.getItem(CONSENT_KEY) === 'true';
      } catch (e) {
        accepted = false;
      }
      if (accepted) return;
      overlay.classList.add('af-visible');
      acceptBtn.addEventListener('click', function () {
        try { window.localStorage.setItem(CONSENT_KEY, 'true'); } catch (e) {}
        overlay.classList.remove('af-visible');
      });
    })();

    var loginForm = document.getElementById('af-login-form');
    if (loginForm) {
      loginForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var email = document.getElementById('af-login-email').value.trim();
        var password = document.getElementById('af-login-password').value;
        if (!email || !password) return;
        window.afLogin(email, password).then(function () {
          loginForm.reset();
          window.location.hash = 'profile';
          loadPublicData();
        }).catch(function (err) {
          alert('Innlogging feilet: ' + (err.message || 'Prøv igjen'));
        });
      });
    }
    document.getElementById('af-logout-btn')?.addEventListener('click', function () {
      window.afLogout();
    });
    document.getElementById('af-theme-dark')?.addEventListener('click', function () {
      setLoggedInTheme('dark');
    });
    document.getElementById('af-theme-light')?.addEventListener('click', function () {
      setLoggedInTheme('light');
    });
    document.getElementById('af-login-google')?.addEventListener('click', function () {
      window.afLoginGoogle().catch(function (err) {
        alert('Innlogging med Google feilet: ' + (err.message || 'Sjekk at Google er aktivert i Supabase.'));
      });
    });
    document.getElementById('af-modal-close')?.addEventListener('click', function () {
      document.getElementById('af-modal-overlay').classList.remove('af-visible');
    });

    // Kart: forstørre / redusere
    var mapExpandBtn = document.getElementById('af-map-expand-btn');
    if (mapExpandBtn) {
      mapExpandBtn.addEventListener('click', function () {
        var expanded = document.body.classList.toggle('af-map-expanded');
        mapExpandBtn.textContent = expanded ? 'Lukk stort kart' : 'Forstørr kart';
        if (mapInstance) {
          setTimeout(function () {
            mapInstance.invalidateSize();
          }, 150);
        }
      });
    }

    initAuth(function () {
      onHashChange();
    });
    initAdmin();
    loadPublicData();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
