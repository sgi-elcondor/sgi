(function () {
  const TYPEAHEAD_TIMEOUT = 500;
  const SEARCH_THRESHOLD  = 8;

  function isMobile() {
    return !!window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
  }

  function hasClippingAncestor(el) {
    let node = el.parentElement;
    while (node && node !== document.body) {
      const cs = getComputedStyle(node);
      const overflow = cs.overflow + cs.overflowX + cs.overflowY;
      if (/(auto|scroll|hidden)/.test(overflow)) return true;
      node = node.parentElement;
    }
    return false;
  }

  const SGISelect = {
    enhance(sel) {
      if (!sel || sel._sgiEnhanced || sel.multiple || sel.hasAttribute("data-sgi-skip")) return;
      if (isMobile()) return;
      sel._sgiEnhanced = true;

      const wrap = document.createElement("div");
      wrap.className = "sgi-select";

      const trigger = document.createElement("button");
      trigger.type = "button";
      trigger.className = "sgi-select-trigger";
      if (sel.classList.contains("select-sm")) trigger.classList.add("sgi-select-trigger--sm");
      trigger.setAttribute("aria-haspopup", "listbox");
      trigger.setAttribute("aria-expanded", "false");
      if (sel.disabled) trigger.disabled = true;

      const label = document.createElement("span");
      label.className = "sgi-select-label";

      const arrow = document.createElement("span");
      arrow.className = "sgi-select-arrow";
      arrow.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`;
      trigger.append(label, arrow);

      const panel = document.createElement("div");
      panel.className = "sgi-select-panel";
      panel.setAttribute("role", "listbox");
      panel.hidden = true;

      const hasSearch = sel.options.length > SEARCH_THRESHOLD;
      let search = null;
      let emptyMsg = null;

      if (hasSearch) {
        const searchWrap = document.createElement("div");
        searchWrap.className = "sgi-select-search-wrap";
        search = document.createElement("input");
        search.type = "text";
        search.className = "sgi-select-search";
        search.placeholder = "Buscar...";
        search.autocomplete = "off";
        searchWrap.append(search);
        panel.append(searchWrap);
      }

      const list = document.createElement("ul");
      list.className = "sgi-select-list";
      panel.append(list);

      if (hasSearch) {
        emptyMsg = document.createElement("p");
        emptyMsg.className = "sgi-select-empty";
        emptyMsg.textContent = "Sin resultados";
        emptyMsg.hidden = true;
        panel.append(emptyMsg);
      }

      sel.parentNode.insertBefore(wrap, sel);
      wrap.append(trigger, panel, sel);
      sel.classList.add("sgi-select-native");

      let highlighted = null;
      let portaled = false;

      function updateLabel() {
        const opt = sel.options[sel.selectedIndex];
        if (!opt || !opt.text) { label.innerHTML = "&nbsp;"; return; }
        label.textContent = opt.text;
      }

      // External `sel.value = "x"` keeps the trigger in sync
      const proto     = Object.getPrototypeOf(sel);
      const desc      = Object.getOwnPropertyDescriptor(proto, "value");
      const nativeSet = desc.set;
      Object.defineProperty(sel, "value", {
        get: desc.get,
        set(v) { nativeSet.call(this, v); updateLabel(); },
        configurable: true,
      });

      function renderOptionItem(opt) {
        const item = document.createElement("li");
        item.className = "sgi-select-option";
        item.setAttribute("role", "option");
        item.dataset.value = opt.value;
        if (opt.disabled) item.classList.add("is-disabled");

        const txt = document.createElement("span");
        txt.className = "sgi-select-option-text";
        txt.textContent = opt.text || " ";
        item.append(txt);

        if (opt.value === sel.value) {
          item.classList.add("is-selected");
          item.setAttribute("aria-selected", "true");
          const check = document.createElement("span");
          check.className = "sgi-select-check";
          check.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
          item.append(check);
        }
        return item;
      }

      function rebuildOptions() {
        list.innerHTML = "";
        Array.from(sel.children).forEach(child => {
          if (child.tagName === "OPTGROUP") {
            const header = document.createElement("li");
            header.className = "sgi-select-group";
            header.textContent = child.label || "";
            list.append(header);
            Array.from(child.children).forEach(opt => {
              if (opt.tagName === "OPTION") list.append(renderOptionItem(opt));
            });
          } else if (child.tagName === "OPTION") {
            list.append(renderOptionItem(child));
          }
        });
      }

      function visibleItems() {
        return Array.from(list.querySelectorAll(".sgi-select-option:not(.is-disabled):not([hidden])"));
      }

      function highlight(item) {
        if (highlighted) highlighted.classList.remove("is-highlighted");
        highlighted = item || null;
        if (highlighted) {
          highlighted.classList.add("is-highlighted");
          highlighted.scrollIntoView({ block: "nearest" });
        }
      }

      function moveHighlight(dir) {
        const items = visibleItems();
        if (!items.length) return;
        let idx = items.indexOf(highlighted);
        idx = (idx + dir + items.length) % items.length;
        highlight(items[idx]);
      }

      function highlightFirst() { const i = visibleItems(); if (i.length) highlight(i[0]); }
      function highlightLast()  { const i = visibleItems(); if (i.length) highlight(i[i.length - 1]); }

      function applySearch() {
        if (!search) return;
        const q = (search.value || "").toLowerCase().trim();
        let visibleCount = 0;
        list.querySelectorAll(".sgi-select-option").forEach(item => {
          const match = !q || item.textContent.toLowerCase().includes(q);
          item.hidden = !match;
          if (match) visibleCount++;
        });
        if (emptyMsg) emptyMsg.hidden = visibleCount > 0;
        const first = visibleItems()[0];
        highlight(first || null);
      }

      function selectItem(item) {
        if (!item || item.classList.contains("is-disabled")) return;
        const val = item.dataset.value;
        if (sel.value !== val) {
          sel.value = val;
          sel.dispatchEvent(new Event("change", { bubbles: true }));
        }
        close();
        trigger.focus();
      }

      function positionPanel() {
        if (!portaled) {
          // Non-portal: rely on CSS absolute, just toggle opens-up
          wrap.classList.remove("opens-up");
          const r = trigger.getBoundingClientRect();
          const spaceBelow = window.innerHeight - r.bottom - 8;
          const spaceAbove = r.top - 8;
          const desiredH   = panel.scrollHeight || 256;
          if (spaceBelow < desiredH && spaceAbove > spaceBelow) {
            wrap.classList.add("opens-up");
          }
          return;
        }

        // Portal mode: compute fixed coordinates from trigger rect
        const r = trigger.getBoundingClientRect();
        // If trigger is fully out of view, close
        if (r.bottom < 0 || r.top > window.innerHeight) { close(); return; }

        const desiredH   = Math.min(panel.scrollHeight || 256, 256);
        const spaceBelow = window.innerHeight - r.bottom - 8;
        const spaceAbove = r.top - 8;
        const opensUp    = spaceBelow < desiredH && spaceAbove > spaceBelow;

        panel.style.position = "fixed";
        panel.style.left     = r.left + "px";
        panel.style.width    = "max-content";
        if (opensUp) {
          panel.style.top    = "auto";
          panel.style.bottom = (window.innerHeight - r.top + 4) + "px";
        } else {
          panel.style.top    = (r.bottom + 4) + "px";
          panel.style.bottom = "auto";
        }
        wrap.classList.toggle("opens-up", opensUp);
      }

      function open() {
        if (trigger.disabled) return;
        rebuildOptions();
        if (search) search.value = "";
        applySearch();

        // Portal pattern: if any ancestor would clip the panel, render it to body
        portaled = hasClippingAncestor(wrap);
        if (portaled) {
          document.body.appendChild(panel);
          panel.classList.add("is-portal");
        }

        panel.hidden = false;
        trigger.setAttribute("aria-expanded", "true");
        wrap.classList.add("is-open");
        positionPanel();

        const sel0 = list.querySelector(".is-selected") || visibleItems()[0];
        highlight(sel0);
        if (search) setTimeout(() => search.focus(), 0);

        document.addEventListener("click", onDocClick, true);
        document.addEventListener("keydown", onKey);

        if (portaled) {
          window.addEventListener("scroll", positionPanel, true);
          window.addEventListener("resize", positionPanel);
        }
      }

      function close() {
        if (panel.hidden) return;
        panel.hidden = true;
        trigger.setAttribute("aria-expanded", "false");
        wrap.classList.remove("is-open", "opens-up");
        highlighted = null;

        document.removeEventListener("click", onDocClick, true);
        document.removeEventListener("keydown", onKey);

        if (portaled) {
          window.removeEventListener("scroll", positionPanel, true);
          window.removeEventListener("resize", positionPanel);
          panel.classList.remove("is-portal");
          panel.style.cssText = "";
          wrap.appendChild(panel);
          portaled = false;
        }
      }

      function onDocClick(e) {
        if (!wrap.contains(e.target) && !panel.contains(e.target)) close();
      }

      let typeaheadBuffer = "";
      let typeaheadTimer = null;
      function typeahead(key) {
        if (search) return false;
        if (key.length !== 1 || !/\S/.test(key)) return false;
        typeaheadBuffer += key.toLowerCase();
        clearTimeout(typeaheadTimer);
        typeaheadTimer = setTimeout(() => { typeaheadBuffer = ""; }, TYPEAHEAD_TIMEOUT);
        const items = visibleItems();
        const match = items.find(it => it.textContent.toLowerCase().trim().startsWith(typeaheadBuffer));
        if (match) highlight(match);
        return !!match;
      }

      function onKey(e) {
        switch (e.key) {
          case "Escape":     e.preventDefault(); close(); trigger.focus(); return;
          case "ArrowDown":  e.preventDefault(); moveHighlight(1); return;
          case "ArrowUp":    e.preventDefault(); moveHighlight(-1); return;
          case "Home":       e.preventDefault(); highlightFirst(); return;
          case "End":        e.preventDefault(); highlightLast(); return;
          case "PageDown":   e.preventDefault(); for (let i = 0; i < 5; i++) moveHighlight(1); return;
          case "PageUp":     e.preventDefault(); for (let i = 0; i < 5; i++) moveHighlight(-1); return;
          case "Enter":      e.preventDefault(); selectItem(highlighted); return;
          case "Tab":        close(); return;
          default:
            if (typeahead(e.key)) e.preventDefault();
        }
      }

      trigger.addEventListener("click", () => { if (panel.hidden) open(); else close(); });

      trigger.addEventListener("keydown", e => {
        const k = e.key;
        if (!panel.hidden) return;
        if (k === "ArrowDown" || k === "Enter" || k === " ") {
          e.preventDefault();
          open();
          return;
        }
        if (k.length === 1 && k !== " " && /\S/.test(k)) {
          e.preventDefault();
          open();
          if (search) setTimeout(() => { search.value = k; applySearch(); }, 0);
          else typeahead(k);
        }
      });

      if (search) {
        search.addEventListener("input", applySearch);
        search.addEventListener("keydown", e => {
          if (e.key === "Enter") e.preventDefault();
        });
      }

      list.addEventListener("click", e => {
        const item = e.target.closest(".sgi-select-option");
        if (item) selectItem(item);
      });

      list.addEventListener("mouseover", e => {
        const item = e.target.closest(".sgi-select-option:not(.is-disabled):not([hidden])");
        if (item) highlight(item);
      });

      window.addEventListener("resize", () => { if (!panel.hidden && !portaled) positionPanel(); });

      // Keep the trigger label AND the open panel in sync with option changes
      new MutationObserver(() => {
        updateLabel();
        if (!panel.hidden) {
          rebuildOptions();
          if (search) applySearch();
          const sel0 = list.querySelector(".is-selected") || visibleItems()[0];
          highlight(sel0);
          if (portaled) positionPanel();
        }
      }).observe(sel, { childList: true });

      updateLabel();
    },

    enhanceAll(root) {
      const scope = root || document;
      scope.querySelectorAll("select:not(.sgi-select-native):not([data-sgi-skip])").forEach(sel => SGISelect.enhance(sel));
    },
  };

  window.SGISelect = SGISelect;

  function autoInit() {
    SGISelect.enhanceAll(document.body);

    const observer = new MutationObserver(mutations => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node.nodeType !== 1) continue;
          if (node.tagName === "SELECT" && !node.classList.contains("sgi-select-native") && !node.hasAttribute("data-sgi-skip")) {
            SGISelect.enhance(node);
          } else if (node.querySelectorAll) {
            node.querySelectorAll("select:not(.sgi-select-native):not([data-sgi-skip])").forEach(s => SGISelect.enhance(s));
          }
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", autoInit);
  } else {
    autoInit();
  }
})();
