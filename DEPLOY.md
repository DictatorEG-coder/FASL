# تشغيل فَصْل على Cloudflare

المستودع موجود بالفعل على GitHub: https://github.com/DictatorEG-coder/FASL
لا تحتاج إلى رفع الملفات مرة أخرى.

## 1) إنشاء قاعدة D1 أولًا
1. افتح Cloudflare Dashboard.
2. افتح **Storage & databases → D1 SQL Database**.
3. اضغط **Create database** وسمّها بالضبط: `fasl-db`.
4. افتح قاعدة البيانات وانسخ **Database ID**.
5. افتح `wrangler.toml` في GitHub، واستبدل:
   `REPLACE_WITH_D1_DATABASE_ID`
   بمعرّف قاعدة البيانات الحقيقي، ثم احفظ التعديل على فرع `main`.

لا تضع أي توكن أو كلمة سر في ملف `wrangler.toml` أو GitHub.

## 2) تهيئة جداول قاعدة البيانات
من صفحة قاعدة D1 افتح **Console**، ثم انسخ محتوى الملف `schema.sql` من المستودع وشغّله مرة واحدة.
بديلًا، من مجلد المشروع باستخدام Wrangler:
```bash
npx wrangler d1 execute fasl-db --remote --file=./schema.sql
```

## 3) ربط GitHub بـ Workers Builds
1. افتح **Workers & Pages** في Cloudflare.
2. اختر **Create application** ثم **GitHub**.
3. اسمح لـ Cloudflare بالوصول إلى GitHub إذا طلب ذلك.
4. اختر المستودع `DictatorEG-coder/FASL` والفرع `main`.
5. اسم الـ Worker يجب أن يكون `fasl-bot` لأنه الاسم الموجود في `wrangler.toml`.
6. Root directory: `/`.
7. Build command: `npm install && npm run typecheck`.
8. Deploy command: `npx wrangler deploy`.
9. احفظ وانشر.

بعد ذلك كل Push جديد إلى `main` سيطلق بناءً ونشرًا تلقائيًا. راجع إعدادات Builds إذا أردت التأكد من اتصال GitHub.

## 4) إضافة أسرار البوت
بعد إنشاء Worker افتح **Settings → Variables and Secrets** وأضف القيم التالية كـ **Secrets**:

| الاسم | القيمة |
|---|---|
| `BOT_TOKEN` | توكن البوت من @BotFather |
| `WEBHOOK_SECRET` | سر عشوائي قوي من أحرف إنجليزية وأرقام و`_` و`-` فقط |
| `ADMIN_IDS` | رقم Telegram ID الخاص بالمالك |

لا ترسل هذه القيم في المحادثات ولا ترفعها إلى GitHub. إذا كان هناك أكثر من مالك، افصل أرقام Telegram IDs بفواصل.

## 5) تسجيل Telegram Webhook
بعد نجاح النشر، انسخ عنوان Worker الذي ينتهي بـ `.workers.dev`. ثم نفّذ من Termux أو أي طرفية، بعد استبدال القيم:

```bash
curl -X POST "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook" \
  -d "url=https://<WORKER_NAME>.<YOUR_SUBDOMAIN>.workers.dev/webhook" \
  -d "secret_token=<WEBHOOK_SECRET>" \
  -d 'allowed_updates=["message","callback_query","poll"]'
```

استخدم عنوان Worker الحقيقي الذي أعطته Cloudflare، وليس المثال أعلاه. يجب أن تكون قيمة `WEBHOOK_SECRET` هي نفسها التي أضفتها في Cloudflare.

لفحص حالة الربط:
```bash
curl "https://api.telegram.org/bot<BOT_TOKEN>/getWebhookInfo"
```

## 6) التجربة
1. افتح البوت في Telegram وأرسل `/start`.
2. أرسل `/stories` واختر القصة.
3. جرّب `/stop` ثم ابدأ من جديد.
4. أرسل `/admin` من حساب المالك.
5. أضف البوت إلى مجموعة، امنحه صلاحية إرسال الرسائل والتصويت، ثم ابدأ القصة من حساب مشرف للمجموعة.

## أوامر المالك
- `/admin` — إحصاءات مختصرة.
- `/broadcast نص الرسالة` — إذاعة إلى المحادثات المسجلة.
- `/story off story-id` — إيقاف قصة.
- `/story on story-id` — تفعيل قصة.

## ملاحظات قبل الإطلاق العام
- Cron يعمل كل دقيقة؛ لذلك مهلة ظهور تصويت المجموعة مستهدفة عند 120 ثانية وقد تتأخر حتى دورة Cron التالية. مدة التصويت نفسها 120 ثانية ويغلقها Telegram تلقائيًا.
- القصة الحالية نموذج أولي واحد. تقدير 15 دقيقة لم يُثبت باختبار لاعبين، والمكتبة تحتاج قصصًا إضافية أطول قبل إطلاق واسع.
- لوحة المالك لا تحتوي بعد على محرر قصص داخل Telegram؛ إضافة قصة جديدة تتم حاليًا بإدخال سجل JSON صحيح في جدول `stories`.
- اختبر البوت في محادثة خاصة ومجموعة تجريبية قبل نشره على مجموعات حقيقية.
