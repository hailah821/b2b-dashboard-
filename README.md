# B2B Dashboard — HubSpot

موقع ويب يسحب البيانات تلقائياً من HubSpot CRM.

## هيكل المشروع

```
b2b-vercel/
├── api/
│   ├── contacts.js     ← Contacts API
│   ├── companies.js    ← Companies API
│   ├── deals.js        ← Deals API (مع فلتر التاريخ)
│   ├── meetings.js     ← Meetings/Activity API
│   └── owners.js       ← Owners API
├── public/
│   └── index.html      ← الموقع الكامل
├── vercel.json         ← إعدادات Vercel
└── README.md
```

## خطوات الرفع على Vercel

### 1. أنشئ حساب Vercel
اذهب لـ https://vercel.com وسجل بـ GitHub أو email

### 2. ثبّت Vercel CLI
```bash
npm install -g vercel
```

### 3. ارفع المشروع
```bash
cd b2b-vercel
vercel
```
اتبع التعليمات (اضغط Enter على كل سؤال)

### 4. أضف HubSpot Token
في Vercel Dashboard:
- اذهب لـ Settings → Environment Variables
- أضف متغير جديد:
  - Name: `HUBSPOT_TOKEN`
  - Value: (الـ token من HubSpot)
  - Environment: Production + Preview

### 5. أعد النشر
```bash
vercel --prod
```

الموقع سيكون متاح على رابط مثل: `https://b2b-dashboard-xxx.vercel.app`

## HubSpot Scopes المطلوبة
- crm.objects.contacts.read
- crm.objects.companies.read
- crm.objects.deals.read
- crm.objects.meetings.read
- crm.objects.owners.read

## المميزات
- تحديث تلقائي كل 5 دقائق
- فلتر Close Date (This Quarter / Last Quarter / This Year)
- Activity Leaderboard by Rep
- Team Activity Totals (Meetings)
- Deal Leaderboard — Amount Closed by Rep
- Deals Won / Lost
- Deal Totals by Create Date with Status Breakdown
