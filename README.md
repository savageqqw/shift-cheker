# Shiftly

Особистий вебзастосунок для обліку графіка роботи, відпрацьованих годин і опрацьованого товару на трейд-ін.

**Стек:** Vue 3 + Vite + Pinia (фронтенд) · Vercel Serverless Functions (бекенд) · Turso/libSQL (база даних) · JWT (вхід за паролем).

## Функціонал

- Базовий графік-ротація (за замовчуванням 5 робочих / 2 вихідних) від опорної дати — налаштовується в «Налаштуваннях».
- Ручна заміна будь-якого дня (робочий ⇄ вихідний) прямо в календарі — для підміни напарника, з коментарем.
- Облік часу зміни: початок, кінець, автоматичний розрахунок тривалості (враховує нічні зміни через північ).
- Облік кількості опрацьованого товару на трейд-ін за зміну.
- Сторінка статистики: загальні/середні години та сума трейд-ін за місяць, минулий місяць, рік чи весь час.
- Вхід за одним паролем (без реєстрації — застосунок особистий, однокористувацький).

## Швидкий старт: викласти на GitHub → Turso → Vercel

### 1. GitHub

Розпакуй архів і заштовхни як звичайний репозиторій:

```bash
cd shiftly
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<твій-нікнейм>/shiftly.git
git push -u origin main
```

### 2. База даних Turso

Онови/встанови Turso CLI, увійди та створи базу:

```bash
curl -sSfL https://get.tur.so/install.sh | bash
turso auth login

turso db create shiftly

turso db show shiftly --url
turso db tokens create shiftly
```

Перша команда (`--url`) дасть значення для `TURSO_DATABASE_URL`, друга — токен для `TURSO_AUTH_TOKEN`. Таблиці створяться самі під час першого запиту до API (міграція вшита в бекенд).

### 3. Vercel

Зайди на [vercel.com](https://vercel.com) → **Add New → Project** → імпортуй репозиторій `shiftly` з GitHub. Vercel сам розпізнає Vite-проєкт.

У розділі **Environment Variables** додай:

| Змінна | Значення |
|---|---|
| `APP_PASSWORD` | пароль, яким входитимеш у застосунок |
| `JWT_SECRET` | будь-який довгий випадковий рядок (напр. `openssl rand -hex 32`) |
| `TURSO_DATABASE_URL` | з кроку 2 |
| `TURSO_AUTH_TOKEN` | з кроку 2 |

Натисни **Deploy**. Після завершення збірки застосунок буде доступний за виданим Vercel посиланням — відкривай і заходь за паролем із `APP_PASSWORD`.

### Локальна розробка (необов'язково)

```bash
npm install
cp .env.example .env   # заповни своїми значеннями
npx vercel dev          # піднімає і фронтенд, і /api локально
```

## Структура проєкту

```
api/                серверні функції (Vercel)
  _lib/db.js         клієнт Turso + міграції схеми
  _lib/auth.js       підпис/перевірка JWT
  auth.js            вхід за паролем
  schedule.js        налаштування циклу + ручні заміни днів
  shifts.js          облік годин і трейд-ін, статистика
src/
  stores/            Pinia: auth, schedule, shifts, toast
  views/             Calendar, Stats, Settings, Login
  components/        AppShell, DayModal, ToastStack
  lib/                api-клієнт, логіка розрахунку графіка
```
