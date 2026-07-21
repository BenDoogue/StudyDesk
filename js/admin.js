(function () {
  const el = (id) => document.getElementById(id);
  const FILE_PATH = 'data/decks.json';

  let repo = '';
  let branch = 'main';
  let token = '';
  let fileSha = null;
  let decks = [];
  let activeDeckIdx = null;
  let activeSectionIdx = null;

  // restore session (token only lives for this tab)
  const saved = sessionStorage.getItem('sd_session');
  if (saved) {
    try {
      const s = JSON.parse(saved);
      el('repoInput').value = s.repo || '';
      el('branchInput').value = s.branch || 'main';
    } catch (e) {}
  }

  el('unlockBtn').addEventListener('click', loadFromGitHub);

  async function loadFromGitHub() {
    repo = el('repoInput').value.trim();
    branch = el('branchInput').value.trim() || 'main';
    token = el('tokenInput').value.trim();
    const status = el('gateStatus');
    status.className = 'status-msg';
    status.textContent = '';

    if (!repo || !token) {
      status.className = 'status-msg err';
      status.textContent = 'Enter a repo and a token.';
      return;
    }

    sessionStorage.setItem('sd_session', JSON.stringify({ repo, branch }));

    try {
      const res = await fetch(
        `https://api.github.com/repos/${repo}/contents/${FILE_PATH}?ref=${branch}`,
        { headers: authHeaders() }
      );
      if (!res.ok) {
        throw new Error(res.status === 404 ? 'File not found at that path/branch.' : `GitHub error: ${res.status}`);
      }
      const data = await res.json();
      fileSha = data.sha;
      const decoded = decodeURIComponent(escape(atob(data.content)));
      decks = JSON.parse(decoded).decks || [];
      el('gate').hidden = true;
      el('editor').hidden = false;
      renderTree();
    } catch (err) {
      status.className = 'status-msg err';
      status.textContent = err.message;
    }
  }

  function authHeaders() {
    return {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
    };
  }

  function slugify(str) {
    return str.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'item';
  }

  function uniqueId(base, existingIds) {
    let id = slugify(base);
    let i = 2;
    while (existingIds.includes(id)) { id = `${slugify(base)}-${i++}`; }
    return id;
  }

  // ---------------- tree ----------------

  function renderTree() {
    const tree = el('tree');
    tree.innerHTML = '';
    decks.forEach((deck, di) => {
      const deckLabel = document.createElement('div');
      deckLabel.className = 'tree-deck';
      deckLabel.textContent = deck.name;
      tree.appendChild(deckLabel);

      deck.sections.forEach((section, si) => {
        const sectionEl = document.createElement('div');
        sectionEl.className = 'tree-section';
        if (di === activeDeckIdx && si === activeSectionIdx) sectionEl.classList.add('active');
        sectionEl.textContent = section.name;
        sectionEl.addEventListener('click', () => {
          activeDeckIdx = di;
          activeSectionIdx = si;
          renderTree();
          renderSectionEditor();
        });
        tree.appendChild(sectionEl);
      });

      const addSectionBtn = document.createElement('button');
      addSectionBtn.textContent = '+ add section';
      addSectionBtn.style.cssText =
        'background:none;border:none;color:var(--muted);font-family:var(--font-mono);font-size:0.72rem;cursor:pointer;padding:4px 0 4px 14px;';
      addSectionBtn.addEventListener('click', () => {
        const name = prompt('Section name?');
        if (!name) return;
        const ids = deck.sections.map((s) => s.id);
        deck.sections.push({ id: uniqueId(name, ids), name, cards: [] });
        activeDeckIdx = di;
        activeSectionIdx = deck.sections.length - 1;
        renderTree();
        renderSectionEditor();
      });
      tree.appendChild(addSectionBtn);
    });
  }

  el('addDeckBtn').addEventListener('click', () => {
    const name = prompt('Deck name?');
    if (!name) return;
    const ids = decks.map((d) => d.id);
    decks.push({ id: uniqueId(name, ids), name, sections: [] });
    renderTree();
  });

  // ---------------- section editor ----------------

  function renderSectionEditor() {
    const wrap = el('sectionEditor');
    if (activeDeckIdx === null || activeSectionIdx === null) {
      el('editorTitle').textContent = 'Select a section';
      wrap.innerHTML = '';
      return;
    }
    const deck = decks[activeDeckIdx];
    const section = deck.sections[activeSectionIdx];
    el('editorTitle').textContent = `${deck.name} / ${section.name}`;

    wrap.innerHTML = '';

    section.cards.forEach((card, ci) => {
      const row = document.createElement('div');
      row.className = 'card-row';
      row.innerHTML = `
        <button class="remove" data-ci="${ci}">remove</button>
        <div class="field">
          <label>Front</label>
          <textarea data-field="front" data-ci="${ci}">${escapeHtml(card.front)}</textarea>
        </div>
        <div class="field" style="margin-bottom:0;">
          <label>Back</label>
          <textarea data-field="back" data-ci="${ci}">${escapeHtml(card.back)}</textarea>
        </div>`;
      wrap.appendChild(row);
    });

    wrap.querySelectorAll('textarea').forEach((ta) => {
      ta.addEventListener('input', (e) => {
        const ci = Number(e.target.dataset.ci);
        const field = e.target.dataset.field;
        section.cards[ci][field] = e.target.value;
      });
    });
    wrap.querySelectorAll('.remove').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const ci = Number(e.target.dataset.ci);
        section.cards.splice(ci, 1);
        renderSectionEditor();
      });
    });

    const addCardBtn = document.createElement('button');
    addCardBtn.className = 'btn secondary';
    addCardBtn.textContent = '+ add card';
    addCardBtn.style.marginTop = '6px';
    addCardBtn.addEventListener('click', () => {
      const ids = section.cards.map((c) => c.id);
      section.cards.push({ id: uniqueId('card', ids), front: '', back: '' });
      renderSectionEditor();
    });
    wrap.appendChild(addCardBtn);
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  // ---------------- save ----------------

  el('saveBtn').addEventListener('click', saveToGitHub);

  async function saveToGitHub() {
    const status = el('saveStatus');
    status.className = 'status-msg';
    status.textContent = 'Saving…';

    const payload = { decks };
    const content = btoa(unescape(encodeURIComponent(JSON.stringify(payload, null, 2))));

    try {
      const res = await fetch(
        `https://api.github.com/repos/${repo}/contents/${FILE_PATH}`,
        {
          method: 'PUT',
          headers: { ...authHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: `Update flashcards — ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`,
            content,
            sha: fileSha,
            branch,
          }),
        }
      );
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.message || `GitHub error: ${res.status}`);
      }
      const data = await res.json();
      fileSha = data.content.sha;
      status.className = 'status-msg ok';
      status.textContent = 'Saved. Pages will rebuild in a minute or two.';
    } catch (err) {
      status.className = 'status-msg err';
      status.textContent = err.message;
    }
  }
})();
