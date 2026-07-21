(function () {
  let decks = [];
  let activeDeck = null;
  let activeSectionIds = new Set();
  let studyCards = [];
  let currentIndex = 0;
  let flipped = false;

  const el = (id) => document.getElementById(id);

  fetch('data/decks.json', { cache: 'no-store' })
    .then((r) => r.json())
    .then((data) => {
      decks = data.decks || [];
      if (decks.length === 0) {
        el('emptyState').hidden = false;
        return;
      }
      renderDeckChips();
    })
    .catch(() => {
      el('emptyState').hidden = false;
      el('emptyState').textContent = 'Could not load data/decks.json.';
    });

  function renderDeckChips() {
    const wrap = el('deckChips');
    wrap.innerHTML = '';
    decks.forEach((deck) => {
      const chip = document.createElement('button');
      chip.className = 'chip';
      chip.textContent = deck.name;
      chip.addEventListener('click', () => selectDeck(deck));
      wrap.appendChild(chip);
    });
  }

  function selectDeck(deck) {
    activeDeck = deck;
    activeSectionIds = new Set(deck.sections.map((s) => s.id)); // default: all sections
    [...el('deckChips').children].forEach((c) =>
      c.classList.toggle('active', c.textContent === deck.name)
    );
    renderSectionChips();
    el('sectionPanel').hidden = false;
    renderCardList();
    el('cardPanel').hidden = false;
    el('studySection').hidden = true;
  }

  function renderSectionChips() {
    const wrap = el('sectionChips');
    wrap.innerHTML = '';
    activeDeck.sections.forEach((section) => {
      const chip = document.createElement('button');
      chip.className = 'chip active';
      chip.textContent = section.name;
      chip.addEventListener('click', () => {
        if (activeSectionIds.has(section.id)) {
          activeSectionIds.delete(section.id);
          chip.classList.remove('active');
        } else {
          activeSectionIds.add(section.id);
          chip.classList.add('active');
        }
        renderCardList();
      });
      wrap.appendChild(chip);
    });
  }

  function currentPoolCards() {
    const pool = [];
    activeDeck.sections
      .filter((s) => activeSectionIds.has(s.id))
      .forEach((s) => s.cards.forEach((c) => pool.push(c)));
    return pool;
  }

  function renderCardList() {
    const listEl = el('cardList');
    listEl.innerHTML = '';
    const pool = currentPoolCards();
    pool.forEach((card) => {
      const row = document.createElement('label');
      row.className = 'card-list-item';
      row.innerHTML = `
        <input type="checkbox" checked data-id="${card.id}">
        <span>
          <div class="front"></div>
          <div class="back"></div>
        </span>`;
      row.querySelector('.front').textContent = card.front;
      row.querySelector('.back').textContent = card.back;
      row.querySelector('input').addEventListener('change', updateCount);
      listEl.appendChild(row);
    });
    updateCount();
  }

  function checkedCards() {
    const ids = [...el('cardList').querySelectorAll('input:checked')].map((i) => i.dataset.id);
    const idSet = new Set(ids);
    return currentPoolCards().filter((c) => idSet.has(c.id));
  }

  function updateCount() {
    const n = checkedCards().length;
    el('cardCount').textContent = `(${n} selected)`;
    el('startBtn').disabled = n === 0;
  }

  el('selectAll').addEventListener('click', () => {
    el('cardList').querySelectorAll('input').forEach((i) => (i.checked = true));
    updateCount();
  });
  el('selectNone').addEventListener('click', () => {
    el('cardList').querySelectorAll('input').forEach((i) => (i.checked = false));
    updateCount();
  });

  el('startBtn').addEventListener('click', () => {
    studyCards = checkedCards();
    if (el('shuffleToggle').checked) shuffle(studyCards);
    currentIndex = 0;
    flipped = false;
    el('studySection').hidden = false;
    renderCard();
    el('studySection').scrollIntoView({ behavior: 'smooth' });
  });

  el('reshuffleBtn').addEventListener('click', () => {
    shuffle(studyCards);
    currentIndex = 0;
    flipped = false;
    renderCard();
  });

  el('backToSelectionBtn').addEventListener('click', () => {
    el('studySection').hidden = true;
    el('cardPanel').scrollIntoView({ behavior: 'smooth' });
  });

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }

  function renderCard() {
    const card = studyCards[currentIndex];
    el('frontText').textContent = card.front;
    el('backText').textContent = card.back;
    el('flashcard').classList.toggle('flipped', flipped);
    el('progressLabel').textContent = `${currentIndex + 1} / ${studyCards.length}`;
    el('prevBtn').disabled = currentIndex === 0;
    el('nextBtn').disabled = currentIndex === studyCards.length - 1;
  }

  el('flashcard').addEventListener('click', () => {
    flipped = !flipped;
    el('flashcard').classList.toggle('flipped', flipped);
  });

  el('prevBtn').addEventListener('click', () => {
    if (currentIndex > 0) {
      currentIndex--;
      flipped = false;
      renderCard();
    }
  });
  el('nextBtn').addEventListener('click', () => {
    if (currentIndex < studyCards.length - 1) {
      currentIndex++;
      flipped = false;
      renderCard();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (el('studySection').hidden) return;
    if (e.key === 'ArrowRight') el('nextBtn').click();
    if (e.key === 'ArrowLeft') el('prevBtn').click();
    if (e.key === ' ') { e.preventDefault(); el('flashcard').click(); }
  });
})();
