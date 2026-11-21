# فَصْل | FASL

بوت قصص تفاعلية على Telegram يعمل عبر **Cloudflare Workers + D1** دون خادم دائم.

## الوظائف الحالية
- مكتبة قصص تُعرض بأزرار، مع دعم تحميل قصص إضافية من جدول D1.
- جلسة مستقلة لكل محادثة، مع منع تداخل جلسات القصة في المحادثة نفسها.
- الخاص: اختيارات مباشرة بأزرار Inline.
- المجموعات: ينشر المشهد أولًا، ثم يفتح التصويت بعد مهلة افتراضية 120 ثانية. التصويت نفسه يغلق تلقائيًا بعد 120 ثانية، ثم يعتمد البوت أعلى الأصوات.
- معالجة التعادل بمسار مشترك محدد في القصة، أو إنهاء آمن بدل اختيار عشوائي.
- إيقاف الجلسة، إحصاءات أولية للمالك، منع تكرار تحديثات Telegram، وحماية webhook بـ secret token.
- تذكير الجمعة اختياري.

## متطلبات
- حساب Cloudflare.
- Telegram bot token من @BotFather.
- GitHub repository مربوط بـ Cloudflare أو Wrangler CLI.
- Node.js 20+ عند النشر عبر CLI.

## إعداد Cloudflare
1. أنشئ D1 باسم `fasl-db`.
2. انسخ `database_id` الحقيقي إلى `wrangler.toml` بدل `REPLACE_WITH_D1_DATABASE_ID`.
3. نفّذ `npm install`.
4. نفّذ `npx wrangler d1 execute fasl-db --remote --file=./schema.sql`.
5. أضف الأسرار:
   - `npx wrangler secret put BOT_TOKEN`
   - `npx wrangler secret put WEBHOOK_SECRET` (قيمة عشوائية طويلة، أحرف وأرقام وشرطة فقط)
   - `npx wrangler secret put ADMIN_IDS` (رقم Telegram ID للمالك؛ يمكن إضافة أكثر من ID بفواصل)
6. انشر: `npm run deploy`.
7. سجّل webhook بعد استبدال القيم:
```bash
curl -X POST "https://api.telegram.org/bot< BOT_TOKEN >/setWebhook" \
  -d "url=https://<WORKER_SUBDOMAIN>.workers.dev/webhook" \
  -d "secret_token=<WEBHOOK_SECRET>" \
  -d 'allowed_updates=["message","callback_query","poll"]'
```
احذف المسافات داخل `<BOT_TOKEN>` عند الاستبدال. لا تشارك التوكن أو السر مع أي شخص.

## التطوير والفحص
```bash
npm install
npm run typecheck
npm run dev
```

## ملاحظات تشغيل مهمة
- Cron مضبوط كل دقيقة؛ لذلك مهلة بدء تصويت المجموعة هي **120 ثانية كموعد مستهدف** وقد يتأخر تنفيذها حتى دورة Cron التالية (بحد أقصى يقارب دقيقة إضافية). إغلاق التصويت نفسه مضبوط من Telegram على 120 ثانية.
- تذكير الجمعة مضبوط حاليًا عند 09:00 UTC (11:00 صباحًا بتوقيت مصر الشتوي/12:00 صيفًا)، ويُرسل مرة واحدة في اليوم لكل المحادثات المسجلة. اضبط التوقيت حسب احتياجك.
- القصة المرفقة نموذج أولي قصصي، وليست بعد مكتبة كبيرة أو ضمانًا موثقًا لمدة 12–20 دقيقة. يجب اختبار زمن القراءة والاختيارات مع لاعبين حقيقيين قبل الإعلان عن المدة.
- لوحة المالك الحالية تعرض إحصاءات أولية فقط؛ أدوات إدارة القصص والإذاعة وجدولة التذكير لكل مجموعة ضمن مرحلة لاحقة.
- لا يوجد أي توكن أو سر داخل المستودع.

## بنية الملفات
- `src/index.ts`: webhook، أوامر Telegram، جلسات، التصويت، cron.
- `src/stories.ts`: محتوى القصص ومساراتها.
- `schema.sql`: جداول D1 والفهارس.
- `wrangler.toml`: إعدادات Worker وD1 وCron.


## Continuous integration
GitHub Actions runs the TypeScript type-check on pushes and pull requests to `main`.
