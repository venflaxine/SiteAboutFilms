
import { useEffect, useMemo, useState } from 'react';
import './App.css';

const API_URL = 'http://localhost:8000';
const REPORT_API_URL = 'http://localhost:8001';

const genres = [
  'Все жанры',
  'Фантастика',
  'Драма',
  'Триллер',
  'Боевик',
  'Приключения',
  'Детектив'
];

const emptyForm = () => ({
  title: '',
  year: new Date().getFullYear(),
  description: '',
  genres: [],
  watched: false,
  rating: ''
});

function App() {
  const [movies, setMovies] = useState([]);
  const [summary, setSummary] = useState(null);

  const [search, setSearch] = useState('');
  const [genre, setGenre] = useState('Все жанры');
  const [status, setStatus] = useState('all');
  const [sort, setSort] = useState('newest');

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm());

  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(true);

  const [error, setError] = useState('');
  const [summaryError, setSummaryError] = useState('');
  const [tmdbQuery, setTmdbQuery] = useState('');
  const [tmdbResults, setTmdbResults] = useState([]);
  const [tmdbLoading, setTmdbLoading] = useState(false);
  const [tmdbError, setTmdbError] = useState('');
  const [addingTmdbId, setAddingTmdbId] = useState(null);
  // Универсальная обработка ответов основного API
  async function apiRequest(url, options = {}) {
    const response = await fetch(`${API_URL}${url}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    if (!response.ok) {
      let message = `Ошибка сервера: ${response.status}`;

      try {
        const data = await response.json();
        message = Array.isArray(data.detail)
          ? data.detail.map(item => item.msg).join(', ')
          : data.detail || message;
      } catch {
        // Оставляем стандартное сообщение
      }

      throw new Error(message);
    }

    if (response.status === 204) return null;
    return response.json();
  }

  // Загрузка фильмов из основного backend
  async function loadMovies() {
    try {
      setError('');

      const data = await apiRequest('/movies');
      setMovies(data);
    } catch (err) {
      setError(`Не удалось загрузить фильмы: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  // Загрузка статистики из отдельного Report Service
  async function loadSummary() {
    try {
      setSummaryLoading(true);
      setSummaryError('');

      const response = await fetch(
        `${REPORT_API_URL}/reports/summary`
      );

      if (!response.ok) {
        throw new Error(`Ошибка сервера: ${response.status}`);
      }

      const data = await response.json();
      setSummary(data);
    } catch (err) {
      setSummary(null);
      setSummaryError(
        `Не удалось загрузить статистику: ${err.message}`
      );
    } finally {
      setSummaryLoading(false);
    }
  }

  // Обновление каталога и статистики одновременно
  async function refreshData() {
    await Promise.all([
      loadMovies(),
      loadSummary()
    ]);
  }

  useEffect(() => {
    refreshData();
  }, []);

  // Поиск, фильтрация и сортировка
  const filteredMovies = useMemo(() => {
    let result = movies.filter(movie => {
      const matchesSearch = movie.title
        .toLowerCase()
        .includes(search.toLowerCase());

      const matchesGenre =
        genre === 'Все жанры' || movie.genres.includes(genre);

      const matchesStatus =
        status === 'all' ||
        (status === 'watched' && movie.watched) ||
        (status === 'planned' && !movie.watched);

      return matchesSearch && matchesGenre && matchesStatus;
    });

    return [...result].sort((a, b) => {
      if (sort === 'newest') return b.year - a.year;
      if (sort === 'oldest') return a.year - b.year;
      if (sort === 'rating') return (b.rating || 0) - (a.rating || 0);
      return a.title.localeCompare(b.title, 'ru');
    });
  }, [movies, search, genre, status, sort]);

  // Значения статистики приходят только из Report Service
  const totalMovies = summary?.total_movies ?? '—';
  const watchedCount = summary?.watched_movies ?? '—';
  const plannedCount = summary?.planned_movies ?? '—';

  const averageRating =
    summary?.average_rating != null
      ? Number(summary.average_rating).toFixed(1)
      : '—';

  // Изменение статуса просмотра
  async function toggleWatched(movie) {
    try {
      setError('');

      const newWatched = !movie.watched;

      await apiRequest(`/movies/${movie._id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({
          watched: newWatched,
          rating: null
        })
      });

      await refreshData();
    } catch (err) {
      setError(`Не удалось изменить статус: ${err.message}`);
    }
  }

  // Изменение оценки
  async function changeRating(movie, rating) {
    try {
      setError('');

      await apiRequest(`/movies/${movie._id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({
          watched: true,
          rating: rating ? Number(rating) : null
        })
      });

      await refreshData();
    } catch (err) {
      setError(`Не удалось изменить оценку: ${err.message}`);
    }
  }

  // Добавление фильма
  async function addMovie(event) {
    event.preventDefault();

    if (!form.title.trim()) return;

    try {
      setError('');

      const newMovie = {
        title: form.title.trim(),
        year: Number(form.year),
        description: form.description,
        genres: form.genres,
        watched: form.watched,
        rating:
          form.watched && form.rating
            ? Number(form.rating)
            : null
      };

      await apiRequest('/movies', {
        method: 'POST',
        body: JSON.stringify(newMovie)
      });

      await refreshData();

      setForm(emptyForm());
      setShowModal(false);
    } catch (err) {
      setError(`Не удалось добавить фильм: ${err.message}`);
    }
  }

  // Удаление фильма
  async function deleteMovie(id) {
    if (!window.confirm('Удалить этот фильм из каталога?')) return;

    try {
      setError('');

      await apiRequest(`/movies/${id}`, {
        method: 'DELETE'
      });

      await refreshData();
    } catch (err) {
      setError(`Не удалось удалить фильм: ${err.message}`);
    }
  }

async function searchTmdb(event) {
  event.preventDefault();

  if (tmdbQuery.trim().length < 2) return;

  try {
    setTmdbLoading(true);
    setTmdbError('');
    setTmdbResults([]);

    const data = await apiRequest(
      `/tmdb/search?query=${encodeURIComponent(tmdbQuery.trim())}`
    );

    setTmdbResults(data.results || []);

    if (!data.results?.length) {
      setTmdbError('Ничего не найдено.');
    }
  } catch (err) {
    setTmdbError(err.message);
  } finally {
    setTmdbLoading(false);
  }
}

async function addTmdbMovie(movie) {
  if (!movie.year) {
    setTmdbError('У фильма не указана дата выхода, его нельзя добавить.');
    return;
  }

  if (movies.some(existing => existing.tmdb_id === movie.id)) {
    setTmdbError('Этот фильм уже есть в твоей коллекции.');
    return;
  }

  try {
    setAddingTmdbId(movie.id);
    setTmdbError('');

    await apiRequest('/movies', {
      method: 'POST',
      body: JSON.stringify({
        title: movie.title,
        year: movie.year,
        description: movie.description,
        genres: movie.genres,
        watched: false,
        rating: null,
        tmdb_id: movie.id,
        poster_path: movie.poster_path,
        tmdb_rating: movie.tmdb_rating,
        original_title: movie.original_title
      })
    });

    await refreshData();
  } catch (err) {
    setTmdbError(err.message);
  } finally {
    setAddingTmdbId(null);
  }
}

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-icon">▶</span> movie<span>catalog</span>
        </div>

        <div className="nav-label">МЕНЮ</div>

        <button className="nav-item active">
          ▦ <span>Моя коллекция</span>
        </button>

        <button
          className="nav-item"
          onClick={() => setStatus('watched')}
        >
          ✓ <span>Просмотренные</span>
        </button>

        <button
          className="nav-item"
          onClick={() => setStatus('planned')}
        >
          ◷ <span>Хочу посмотреть</span>
        </button>

        <button
          className="nav-item"
          onClick={() => {
            setStatus('all');
            setGenre('Все жанры');
          }}
        >
          ◈ <span>Все фильмы</span>
        </button>

        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span>🎬</span>
            <strong>Твоя личная кинотека</strong>
            <p>Все любимые фильмы в одном месте.</p>
          </div>

          <div className="version">MOVIE CATALOG · 1.0</div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="breadcrumb">
            Коллекция <span>/</span> Все фильмы
          </div>

          <button
            className="add-button"
            onClick={() => setShowModal(true)}
          >
            ＋ Добавить фильм
          </button>
        </header>

        <section className="content">
          <div className="welcome">
            <div>
              <div className="eyebrow">ТВОЯ ЛИЧНАЯ КИНОТЕКА</div>
              <h1>Моя коллекция<span>.</span></h1>
              <p>
                Храни впечатления, оценивай фильмы и планируй новые просмотры.
              </p>
            </div>

            <div className="welcome-icon">🎞️</div>
          </div>

          {error && (
            <div className="error-message">
              {error}
              <button onClick={loadMovies}>Повторить</button>
            </div>
          )}

          {summaryError && (
            <div className="error-message">
              {summaryError}
              <button onClick={loadSummary}>Повторить</button>
            </div>
          )}

          <div className="stats">
            <div className="stat-card">
              <div className="stat-icon purple">▦</div>
              <div>
                <span>Всего фильмов</span>
                <strong>
                  {summaryLoading ? '...' : totalMovies}
                </strong>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon green">✓</div>
              <div>
                <span>Просмотрено</span>
                <strong>
                  {summaryLoading ? '...' : watchedCount}
                </strong>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon orange">◷</div>
              <div>
                <span>В планах</span>
                <strong>
                  {summaryLoading ? '...' : plannedCount}
                </strong>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon yellow">★</div>
              <div>
                <span>Средняя оценка</span>
                <strong>
                  {summaryLoading ? '...' : averageRating}
                </strong>
              </div>
            </div>
          </div>

<section className="tmdb-search">
  <div className="tmdb-heading">
    <div>
      <span className="eyebrow">ВНЕШНЯЯ БАЗА ФИЛЬМОВ</span>
      <h2>Найти фильм в TMDB</h2>
      <p>Поиск по мировой базе фильмов</p>
    </div>
  </div>

  <form className="tmdb-search-form" onSubmit={searchTmdb}>
    <input
      value={tmdbQuery}
      onChange={e => setTmdbQuery(e.target.value)}
      placeholder="Например, Интерстеллар..."
    />

    <button
      type="submit"
      disabled={tmdbLoading || tmdbQuery.trim().length < 2}
    >
      {tmdbLoading ? 'Ищем...' : 'Найти фильм'}
    </button>
  </form>

  {tmdbError && (
    <div className="tmdb-error">{tmdbError}</div>
  )}

  {tmdbResults.length > 0 && (
    <div className="tmdb-results">
      {tmdbResults.map(movie => {
        const alreadyAdded = movies.some(
          existing => existing.tmdb_id === movie.id
        );

        return (
          <article className="tmdb-result" key={movie.id}>
            <div className="tmdb-result-poster">
              {movie.poster_path ? (
                <img
                  src={`https://image.tmdb.org/t/p/w342${movie.poster_path}`}
                  alt={movie.title}
                />
              ) : (
                <span>Нет постера</span>
              )}
            </div>

            <div className="tmdb-result-info">
              <h3>{movie.title}</h3>

              <div>
                {movie.year || 'Год неизвестен'}
                {' · '}
                {movie.genres.join(', ')}
              </div>

              <p>
                {movie.description || 'Описание отсутствует.'}
              </p>

              <span>
                Рейтинг TMDB: {Number(movie.tmdb_rating || 0).toFixed(1)} / 10
              </span>

              <button
                type="button"
                disabled={
                  alreadyAdded ||
                  !movie.year ||
                  addingTmdbId === movie.id
                }
                onClick={() => addTmdbMovie(movie)}
              >
                {alreadyAdded
                  ? 'Уже в коллекции'
                  : addingTmdbId === movie.id
                    ? 'Добавляем...'
                    : 'Добавить в коллекцию'}
              </button>
            </div>
          </article>
        );
      })}
    </div>
  )}

  <div className="tmdb-attribution">
    <a href="https://www.themoviedb.org/" target="_blank" rel="noreferrer">
      TMDB
    </a>
    <span>
      This product uses the TMDB API but is not endorsed or certified by TMDB.
    </span>
  </div>
</section>

          <div className="section-heading">
            <div>
              <h2>Фильмы</h2>
              <span>{filteredMovies.length} в списке</span>
            </div>
          </div>

          <div className="filters">
            <div className="search-box">
              <span>⌕</span>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Поиск по названию..."
              />
            </div>

            <select
              value={genre}
              onChange={e => setGenre(e.target.value)}
            >
              {genres.map(item => (
                <option key={item}>{item}</option>
              ))}
            </select>

            <select
              value={status}
              onChange={e => setStatus(e.target.value)}
            >
              <option value="all">Все фильмы</option>
              <option value="watched">Просмотренные</option>
              <option value="planned">В планах</option>
            </select>

            <select
              value={sort}
              onChange={e => setSort(e.target.value)}
            >
              <option value="newest">Сначала новые</option>
              <option value="oldest">Сначала старые</option>
              <option value="rating">По оценке</option>
              <option value="title">По названию</option>
            </select>
          </div>

          {loading ? (
            <div className="empty-state">
              <span>⏳</span>
              <h3>Загружаем фильмы...</h3>
            </div>
          ) : (
            <>
              <div className="movie-grid">
                {filteredMovies.map(movie => (
                  <article className="movie-card" key={movie._id}>
                    <div className="poster custom">
                      {movie.poster_path ? (
                        <img
                          className="poster-image"
                          src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`}
                          alt={movie.title}
                        />
                      ) : (
                        <>
                          <span className="poster-symbol">✦</span>
                          <span className="poster-year">{movie.year}</span>
                          <span className="poster-title">{movie.title}</span>
                          <span className="poster-caption">
                            MOVIE COLLECTION
                          </span>
                        </>
                      )}

                      {movie.watched && (
                        <span className="watched-badge">
                          ✓ Просмотрено
                        </span>
                      )}
                    </div>

                    <div className="movie-info">
                      <div className="movie-title-row">
                        <h3>{movie.title}</h3>

                        {movie.watched && movie.rating && (
                          <span className="rating">
                            ★ {movie.rating}
                          </span>
                        )}
                      </div>

                      <div className="movie-meta">
                        {movie.year} · {movie.genres.join(', ')}
                      </div>

                      <p className="movie-description">
                        {movie.description}
                      </p>

                      <div className="movie-actions">
                        <button
                          className={
                            movie.watched
                              ? 'watched-button'
                              : 'plan-button'
                          }
                          onClick={() => toggleWatched(movie)}
                        >
                          {movie.watched
                            ? '✓ Просмотрено'
                            : '＋ Отметить просмотр'}
                        </button>

                        {movie.watched && (
                          <select
                            aria-label="Личная оценка"
                            value={movie.rating || ''}
                            onChange={e =>
                              changeRating(movie, e.target.value)
                            }
                          >
                            <option value="">Оценка</option>
                            {[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map(n => (
                              <option key={n} value={n}>
                                {n} / 10
                              </option>
                            ))}
                          </select>
                        )}

                        <button
                          className="delete-button"
                          title="Удалить фильм"
                          onClick={() => deleteMovie(movie._id)}
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>

              {filteredMovies.length === 0 && (
                <div className="empty-state">
                  <span>🎬</span>
                  <h3>Фильмы не найдены</h3>
                  <p>
                    Попробуй изменить параметры поиска или добавь новый фильм.
                  </p>
                  <button
                    className="add-button"
                    onClick={() => setShowModal(true)}
                  >
                    ＋ Добавить фильм
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </main>

      {showModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowModal(false)}
        >
          <form
            className="modal"
            onSubmit={addMovie}
            onClick={e => e.stopPropagation()}
          >
            <div className="modal-heading">
              <div>
                <span className="eyebrow">ТВОЯ КОЛЛЕКЦИЯ</span>
                <h2>Новый фильм</h2>
              </div>

              <button
                type="button"
                className="close-button"
                onClick={() => setShowModal(false)}
              >
                ×
              </button>
            </div>

            <label>
              Название фильма
              <input
                required
                value={form.title}
                onChange={e =>
                  setForm({ ...form, title: e.target.value })
                }
                placeholder="Например, Интерстеллар"
              />
            </label>

            <label>
              Год выпуска
              <input
                required
                type="number"
                min="1888"
                max="2100"
                value={form.year}
                onChange={e =>
                  setForm({ ...form, year: e.target.value })
                }
              />
            </label>

            <label>
              Описание
              <textarea
                value={form.description}
                onChange={e =>
                  setForm({ ...form, description: e.target.value })
                }
                placeholder="Краткое описание фильма..."
              />
            </label>

            <label>Жанры</label>

            <div className="genre-choices">
              {genres.slice(1).map(item => (
                <button
                  type="button"
                  key={item}
                  className={
                    form.genres.includes(item)
                      ? 'genre-choice selected'
                      : 'genre-choice'
                  }
                  onClick={() =>
                    setForm({
                      ...form,
                      genres: form.genres.includes(item)
                        ? form.genres.filter(g => g !== item)
                        : [...form.genres, item]
                    })
                  }
                >
                  {item}
                </button>
              ))}
            </div>

            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={form.watched}
                onChange={e =>
                  setForm({
                    ...form,
                    watched: e.target.checked,
                    rating: e.target.checked ? form.rating : ''
                  })
                }
              />
              Уже посмотрел
            </label>

            {form.watched && (
              <label>
                Моя оценка
                <select
                  value={form.rating}
                  onChange={e =>
                    setForm({ ...form, rating: e.target.value })
                  }
                >
                  <option value="">Без оценки</option>
                  {[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map(n => (
                    <option key={n} value={n}>
                      {n} / 10
                    </option>
                  ))}
                </select>
              </label>
            )}

            <button
              type="submit"
              className="add-button submit-button"
            >
              Добавить в коллекцию
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

export default App;
