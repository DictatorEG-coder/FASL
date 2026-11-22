export type Axis = "analysis" | "creation" | "action" | "people" | "strategy" | "exploration" | "organization";
export type TestOption = { text: string; scores: Partial<Record<Axis, number>> };
export type TestQuestion = { prompt: string; options: TestOption[]; correctIndex?: number; explanation?: string };
export type FaslTest = {
  id: string; title: string; description: string; questions: TestQuestion[]; kind?: "aptitude";
  results: Record<Axis, { title: string; description: string; strengths: string; improve: string; match: string }>;
};

const generalResults: FaslTest["results"] = {
  analysis: { title: "المحلّل", description: "تميل إلى تفكيك المشكلة وفهم أسبابها قبل إصدار الحكم. لا تكتفي بالإجابة السريعة؛ تريد أن تعرف لماذا هي صحيحة.", strengths: "الدقة، اكتشاف التناقضات، التفكير المنطقي، وربط التفاصيل.", improve: "لا تجعل البحث عن اليقين يؤخر قرارًا يمكن اتخاذه بمعلومات كافية.", match: "البحث، تحليل البيانات، الجودة، التحقيق، والتخطيط." },
  creation: { title: "المبتكر", description: "ترى احتمالات لا يلاحظها الآخرون، وتحب إعادة صياغة المشكلة بدل قبول حدودها الأولى.", strengths: "الخيال، توليد الأفكار، المرونة، ورؤية البدائل.", improve: "حوّل الأفكار إلى خطوات قابلة للتنفيذ، ولا تترك كثرة الاحتمالات تشتتك.", match: "التصميم، تطوير المنتجات، المحتوى، الابتكار، وريادة الأعمال." },
  action: { title: "المنفّذ", description: "تفضّل تحويل الكلام إلى تجربة ونتيجة. تتعلم من الحركة والتطبيق أكثر من الانتظار الطويل.", strengths: "الحسم، المبادرة، التعامل العملي، والإنجاز.", improve: "امنح نفسك لحظة للتحقق من المخاطر قبل القفز إلى التنفيذ.", match: "العمليات، إدارة المشاريع، التشغيل، الهندسة التطبيقية، واللوجستيات." },
  people: { title: "المتواصل", description: "تقرأ أثر القرارات على الناس، وتنتبه إلى ما لا يُقال بقدر انتباهك إلى الكلمات.", strengths: "الاستماع، التعاون، فهم وجهات النظر، وبناء الثقة.", improve: "لا تتحمل مسؤولية مشاعر الجميع على حساب حدودك وأولوياتك.", match: "الموارد البشرية، التعليم، خدمة العملاء، العلاقات، والعمل الجماعي." },
  strategy: { title: "الاستراتيجي", description: "تنظر إلى الصورة الكبيرة وتفكر في العواقب والخطوات التالية. يهمك أن يكون للقرار اتجاه واضح.", strengths: "ترتيب الأولويات، توقع النتائج، التنظيم، ورؤية الأنماط.", improve: "اترك مساحة للتغيير عندما تظهر معلومات جديدة، ولا تتمسك بالخطة لمجرد أنها خطتك.", match: "الإدارة، الاستراتيجية، قيادة الفرق، الاستشارات، وتطوير الأعمال." },
  exploration: { title: "المستكشف", description: "تنجذب إلى المجهول والتجارب الجديدة، وتتعلم بالملاحظة والسؤال وتجربة طرق مختلفة.", strengths: "الفضول، سرعة التعلم، التكيف، والانفتاح على التجربة.", improve: "اختر ما يستحق الاستمرار؛ ليس كل جديد فرصة يجب ملاحقتها.", match: "البحث والتطوير، الاستكشاف، التقنية، الصحافة، والتعلم المستمر." },
  organization: { title: "المنظّم", description: "ترتاح إلى وضوح الإجراءات وترتيب المعلومات ومتابعة التفاصيل حتى تكتمل المهمة.", strengths: "الانضباط، التوثيق، الاتساق، وإدارة التفاصيل.", improve: "لا تجعل الالتزام بالإجراء يمنعك من اقتراح تحسينه عندما لا يعود مناسبًا.", match: "المحاسبة، إدارة العمليات، الامتثال، إدارة السجلات، وضبط الجودة." }
};

const qs = (items: [string, [string, Axis][], [string, Axis][], [string, Axis][]]): TestQuestion[] =>
  items.map(([prompt, a, b, c]) => ({ prompt, options: [a,b,c].map(([text, axis]) => ({ text, scores: { [axis]: 2 } })) }));

const thinking: TestQuestion[] = [
  { prompt:"عندما تواجه مشكلة معقدة، ما أول ما تفعله؟", options:[{text:"أقسمها إلى أجزاء وأبحث عن السبب",scores:{analysis:2,strategy:1}},{text:"أتخيل حلولًا غير معتادة",scores:{creation:2,exploration:1}},{text:"أجرب حلًا سريعًا وأتعلم من النتيجة",scores:{action:2,exploration:1}},{text:"أفهم من سيتأثر بها وأسمع وجهات النظر",scores:{people:2}}]},
  { prompt:"في مشروع جماعي، ما الدور الذي تجده طبيعيًا؟", options:[{text:"أراجع التفاصيل وأكشف الأخطاء",scores:{analysis:2}},{text:"أقترح الفكرة والشكل المختلف",scores:{creation:2}},{text:"أقسم المهام وأتابع الإنجاز",scores:{strategy:2,action:1}},{text:"أقرب وجهات النظر وأحافظ على التعاون",scores:{people:2}}]},
  { prompt:"أي معلومة تجذب انتباهك أكثر؟", options:[{text:"رقم أو دليل يكشف نمطًا خفيًا",scores:{analysis:2}},{text:"فكرة جديدة يمكن تحويلها إلى شيء",scores:{creation:2}},{text:"طريقة عملية تختصر الوقت",scores:{action:2}},{text:"قصة تكشف دوافع الناس",scores:{people:2,exploration:1}}]},
  { prompt:"إذا تغيّرت الخطة فجأة، كيف تتصرف؟", options:[{text:"أعيد تقييم المعطيات قبل المتابعة",scores:{analysis:1,strategy:2}},{text:"أبتكر مسارًا بديلًا",scores:{creation:2,exploration:1}},{text:"أتحرك فورًا بما هو متاح",scores:{action:2}},{text:"أتأكد أن الفريق فهم التغيير",scores:{people:2}}]},
  { prompt:"ما الذي يجعلك تثق في قرار؟", options:[{text:"أدلة يمكن التحقق منها",scores:{analysis:2}},{text:"أنه يفتح احتمالًا أفضل",scores:{creation:2,exploration:1}},{text:"أنه قابل للتنفيذ الآن",scores:{action:2}},{text:"أنه يوازن بين النتائج والناس",scores:{people:1,strategy:1}}]},
  { prompt:"أمامك وقت فراغ غير مخطط، ماذا تختار؟", options:[{text:"أقرأ أو أبحث في موضوع أريد فهمه",scores:{analysis:1,exploration:2}},{text:"أصنع شيئًا أو أكتب فكرة",scores:{creation:2}},{text:"أنجز مهمة مؤجلة",scores:{action:2,strategy:1}},{text:"أتواصل مع شخص أو أشارك نشاطًا",scores:{people:2}}]},
  { prompt:"أي خطأ يزعجك أكثر؟", options:[{text:"استنتاج بلا دليل",scores:{analysis:2}},{text:"رفض فكرة لمجرد أنها مختلفة",scores:{creation:2}},{text:"كلام كثير بلا تنفيذ",scores:{action:2}},{text:"قرار يتجاهل أثره على الآخرين",scores:{people:2}}]},
  { prompt:"كيف تفضّل تعلم مهارة جديدة؟", options:[{text:"أفهم المبادئ ثم أتدرّب",scores:{analysis:2}},{text:"أجرب وأكتشف طريقتي",scores:{exploration:2,creation:1}},{text:"أتبع خطوات واضحة وأطبقها",scores:{action:2,strategy:1}},{text:"أتعلم مع شخص وأتبادل الملاحظات",scores:{people:2}}]}
];

const personality: TestQuestion[] = [
  { prompt:"في موقف غامض، ما أول ما تبحث عنه؟", options:[{text:"تفصيل صغير لا يتفق مع الباقي",scores:{analysis:2}},{text:"احتمال لم يفكر فيه أحد",scores:{creation:2}},{text:"خطوة تمنحني زمام المبادرة",scores:{action:2}},{text:"ما الذي يخفيه كل شخص",scores:{people:2}}]},
  { prompt:"أي وصف يقترب منك وقت الضغط؟", options:[{text:"أهدأ وأرتب الحقائق",scores:{analysis:2}},{text:"أبحث عن مخرج غير تقليدي",scores:{creation:2}},{text:"أتحمل المسؤولية وأتحرك",scores:{action:2}},{text:"أحافظ على تماسك المجموعة",scores:{people:2}}]},
  { prompt:"لو كنت شخصية في فريق مغامرة، ستكون...", options:[{text:"العقل الذي يقرأ الخريطة",scores:{analysis:2}},{text:"صاحب الفكرة غير المتوقعة",scores:{creation:2}},{text:"من يتقدم وقت الخطر",scores:{action:2}},{text:"من يفهم رفاقه ويجمعهم",scores:{people:2}}]},
  { prompt:"ما الذي يدفعك للاستمرار؟", options:[{text:"الوصول إلى الحقيقة",scores:{analysis:2,exploration:1}},{text:"صناعة شيء يحمل بصمتي",scores:{creation:2}},{text:"تحقيق هدف واضح",scores:{action:2,strategy:1}},{text:"أن يكون لعملي أثر في أحد",scores:{people:2}}]},
  { prompt:"عندما يختلف معك شخص، ماذا تفعل؟", options:[{text:"أطلب منه تفسيرًا وأقارن الأدلة",scores:{analysis:2}},{text:"أبحث عن زاوية جديدة للحوار",scores:{creation:1,exploration:1}},{text:"أوضح موقفي وأحسم ما يمكن حسمه",scores:{action:2}},{text:"أحاول فهم الدافع وراء رأيه",scores:{people:2}}]},
  { prompt:"أي مكان تختار لقضاء يوم؟", options:[{text:"مكتبة أو مكان هادئ للبحث",scores:{analysis:1,exploration:1}},{text:"ورشة أو مساحة لصناعة الأفكار",scores:{creation:2}},{text:"مكان مليء بالتحديات والحركة",scores:{action:2}},{text:"مكان يجمع أشخاصًا تحبهم",scores:{people:2}}]},
  { prompt:"ما الصفة التي تقدرها أكثر؟", options:[{text:"الإنصاف والدقة",scores:{analysis:2}},{text:"الأصالة والخيال",scores:{creation:2}},{text:"الشجاعة والانضباط",scores:{action:2}},{text:"الوفاء والتفهم",scores:{people:2}}]},
  { prompt:"اختر العبارة الأقرب إليك:", options:[{text:"أريد أن أفهم ما وراء الظاهر",scores:{analysis:2,exploration:1}},{text:"أريد أن أرى ما لم يُجرّب بعد",scores:{creation:2,exploration:1}},{text:"أريد أن أكون الشخص الذي ينجز",scores:{action:2,strategy:1}},{text:"أريد أن أترك أثرًا طيبًا في الناس",scores:{people:2}}]}
];

const career: TestQuestion[] = [
  { prompt:"أي مهمة تستمتع بها أكثر؟", options:[{text:"تحليل معلومات واكتشاف الأنماط",scores:{analysis:2}},{text:"تصميم فكرة أو منتج جديد",scores:{creation:2}},{text:"تنظيم التنفيذ وتحقيق الهدف",scores:{strategy:2,action:1}},{text:"مساعدة شخص أو تطوير فريق",scores:{people:2}}]},
  { prompt:"في يوم عمل مثالي، تفضّل...", options:[{text:"مهام تتطلب تركيزًا وبيانات",scores:{analysis:2}},{text:"مساحة للتجربة والابتكار",scores:{creation:2}},{text:"أهدافًا واضحة ونتائج قابلة للقياس",scores:{action:2}},{text:"تعاونًا وتواصلًا مستمرًا",scores:{people:2}}]},
  { prompt:"أي مشكلة تحب حلها؟", options:[{text:"لماذا لا تعمل هذه العملية؟",scores:{analysis:2}},{text:"كيف نجعل التجربة أفضل؟",scores:{creation:2}},{text:"كيف ننجزها بموارد أقل؟",scores:{strategy:2}},{text:"كيف نجعل الخدمة أنسب للناس؟",scores:{people:2}}]},
  { prompt:"ما نوع المسؤولية الذي يناسبك؟", options:[{text:"مراجعة الجودة وصحة المعلومات",scores:{analysis:2}},{text:"ابتكار حلول ومفاهيم",scores:{creation:2}},{text:"قيادة التنفيذ ومتابعة الأداء",scores:{strategy:2,action:1}},{text:"تطوير الأفراد والتواصل معهم",scores:{people:2}}]},
  { prompt:"إذا تلقيت تعليمات غير واضحة، ست...", options:[{text:"تطلب معايير ومعلومات دقيقة",scores:{analysis:2}},{text:"تقترح أكثر من طريقة لتنفيذها",scores:{creation:2}},{text:"تضع خطة أولية وتختبرها",scores:{action:2,strategy:1}},{text:"تتأكد من توقعات كل الأطراف",scores:{people:2}}]},
  { prompt:"أي إنجاز يمنحك رضا أكبر؟", options:[{text:"اكتشاف خطأ منع خسارة",scores:{analysis:2}},{text:"إطلاق فكرة جديدة",scores:{creation:2}},{text:"إنهاء مشروع صعب في موعده",scores:{action:2}},{text:"مساعدة فريق على التطور",scores:{people:2}}]},
  { prompt:"كيف تتعامل مع ضغط المواعيد؟", options:[{text:"أحدد الأولويات وفق الأدلة",scores:{analysis:1,strategy:2}},{text:"أبحث عن اختصار مبتكر",scores:{creation:2}},{text:"أقسم العمل وأنفذ فورًا",scores:{action:2}},{text:"أنسق مع الفريق وأوزع الأعباء",scores:{people:2,strategy:1}}]},
  { prompt:"أي بيئة عمل تفضل؟", options:[{text:"بحثية أو تقنية متخصصة",scores:{analysis:2,exploration:1}},{text:"إبداعية ومرنة",scores:{creation:2}},{text:"سريعة وواضحة الأهداف",scores:{action:2}},{text:"تعاونية وتركز على الإنسان",scores:{people:2}}]},
  { prompt:"عندما تتعلم أداة جديدة، ما الذي يشجعك؟", options:[{text:"فهم آلية عملها",scores:{analysis:2}},{text:"اكتشاف استخدامات جديدة لها",scores:{creation:1,exploration:2}},{text:"استخدامها لإنجاز مهمة حقيقية",scores:{action:2}},{text:"مشاركة معرفتها مع الآخرين",scores:{people:2}}]},
  { prompt:"أي نتيجة مهنية تريد أن تُعرف بها؟", options:[{text:"خبير يعتمد عليه في التحليل",scores:{analysis:2}},{text:"صاحب أفكار وحلول مختلفة",scores:{creation:2}},{text:"شخص يحقق النتائج ويقود التنفيذ",scores:{strategy:1,action:2}},{text:"شخص يطور الناس ويحسن تجربتهم",scores:{people:2}}]}
];

const aptitude: TestQuestion[] = [
  {prompt:"أكمل المتتالية: 2، 6، 12، 20، 30، ؟",options:[{text:"36",scores:{}},{text:"42",scores:{}},{text:"40",scores:{}},{text:"44",scores:{}}],correctIndex:1,explanation:"الفروق هي 4 ثم 6 ثم 8 ثم 10؛ الفرق التالي 12، إذن الناتج 42."},
  {prompt:"كل المحللين في فريق ما يتحققون من مصادرهم. ليلى محللة في هذا الفريق. ما النتيجة اللازمة؟",options:[{text:"ليلى تتحقق من مصادرها",scores:{}},{text:"ليلى تقود الفريق",scores:{}},{text:"كل من يتحقق من المصادر محلل",scores:{}},{text:"لا يمكن استنتاج شيء",scores:{}}],correctIndex:0,explanation:"هذه نتيجة مباشرة من القاعدة العامة وانطباقها على ليلى."},
  {prompt:"منتج سعره 240 جنيهًا، خُفّض بنسبة 15%. ما السعر بعد الخصم؟",options:[{text:"196",scores:{}},{text:"204",scores:{}},{text:"210",scores:{}},{text:"216",scores:{}}],correctIndex:1,explanation:"15% من 240 تساوي 36؛ 240 ناقص 36 يساوي 204."},
  {prompt:"اختر العلاقة الأقرب: قلم : كتابة",options:[{text:"مطرقة : مسمار",scores:{}},{text:"فرشاة : رسم",scores:{}},{text:"كتاب : مكتبة",scores:{}},{text:"باب : منزل",scores:{}}],correctIndex:1,explanation:"القلم أداة للكتابة، والفرشاة أداة للرسم."},
  {prompt:"أكمل تسلسل الحروف: A، C، F، J، O، ؟",options:[{text:"S",scores:{}},{text:"T",scores:{}},{text:"U",scores:{}},{text:"V",scores:{}}],correctIndex:2,explanation:"القفزات تزيد: +2، +3، +4، +5، ثم +6؛ الحرف التالي U."},
  {prompt:"في صندوق 5 كرات حمراء و3 زرقاء. ما أقل عدد تسحبه دون نظر لتضمن كرتين من اللون نفسه؟",options:[{text:"2",scores:{}},{text:"3",scores:{}},{text:"4",scores:{}},{text:"5",scores:{}}],correctIndex:1,explanation:"بمبدأ الحمام، سحبتان قد تكونان بلونين مختلفين؛ الثالثة تضمن تكرار لون."},
  {prompt:"إذا أنجز 4 موظفين مهمة في 6 ساعات بالمعدل نفسه، فكم ساعة يحتاج 8 موظفين للمهمة نفسها؟",options:[{text:"2",scores:{}},{text:"3",scores:{}},{text:"4",scores:{}},{text:"12",scores:{}}],correctIndex:1,explanation:"إجمالي العمل 24 ساعة-موظف؛ تقسيمها على 8 موظفين يعطي 3 ساعات."},
  {prompt:"بدأ الاجتماع قبل انتهاء التقرير. التقرير لا يمكن اعتماده قبل مراجعته. أي عبارة مؤكدة؟",options:[{text:"التقرير اعتُمد قبل الاجتماع",scores:{}},{text:"التقرير لم يُراجع أبدًا",scores:{}},{text:"لا يمكن الجزم بأن التقرير اعتُمد",scores:{}},{text:"الاجتماع أُلغي",scores:{}}],correctIndex:2,explanation:"المعطيات لا تقول إن المراجعة تمت؛ لذلك لا يمكن استنتاج الاعتماد."}
];

const workplace: TestQuestion[] = [
  {prompt:"اكتشفت خطأً مؤثرًا قبل تسليم فريقك للعمل بدقائق. ماذا تفعل؟",options:[{text:"أبلغ المسؤول فورًا مع وصف أثر الخطأ",scores:{analysis:2,people:1}},{text:"أصلحه وحدي دون إخبار أحد",scores:{action:1}},{text:"أخفيه حتى لا يتأخر التسليم",scores:{action:1}},{text:"أجمع المعلومات وأقترح بدائل سريعة",scores:{strategy:2,analysis:1}}]},
  {prompt:"زميل يتأخر باستمرار ويؤثر في عمل الفريق. كيف تتصرف؟",options:[{text:"أتحدث معه مباشرة وأفهم السبب",scores:{people:2}},{text:"أوثق التأخير وأناقشه مع المسؤول وفق الإجراء",scores:{analysis:1,strategy:2}},{text:"أعيد توزيع العمل مؤقتًا وأوضح أثر ذلك",scores:{action:1,strategy:2}},{text:"أتجاهل الأمر ما دامت مهمتي انتهت",scores:{action:1}}]},
  {prompt:"تلقيت مهمة جديدة بموعد ضيق وتعليمات ناقصة. ما خطوتك الأولى؟",options:[{text:"أحدد المطلوب والنتيجة المتوقعة مع صاحب المهمة",scores:{analysis:1,people:1}},{text:"أبدأ فورًا وأفترض التفاصيل الناقصة",scores:{action:2}},{text:"أضع خطة ومخاطر ونقاط مراجعة",scores:{strategy:2}},{text:"أقترح طريقة مختلفة لتقليل الوقت",scores:{creation:2}}]},
  {prompt:"عميل غاضب بسبب مشكلة لم تتسبب فيها. كيف تستجيب؟",options:[{text:"أستمع وألخص المشكلة ثم أوضح الخطوات",scores:{people:2}},{text:"أشرح له أن الخطأ ليس مني",scores:{analysis:1}},{text:"أعده بحل فوري قبل التحقق",scores:{action:1}},{text:"أبحث عن السبب الجذري وأمنع تكراره",scores:{analysis:2,strategy:1}}]},
  {prompt:"اختلفت مع مديرك حول قرار تعتقد أنه يحمل مخاطرة. ماذا تفعل؟",options:[{text:"أعرض الأدلة والبدائل باحترام",scores:{analysis:2,people:1}},{text:"أنفذ دون نقاش مهما كانت المخاطر",scores:{action:1}},{text:"أطلب توضيح معيار القرار وأثره المتوقع",scores:{strategy:2}},{text:"أبحث عن تجربة صغيرة تختبر الفكرة",scores:{creation:1,exploration:2}}]},
  {prompt:"لديك ثلاث مهام عاجلة ولا يمكن إنجازها كلها في الوقت المتاح. كيف تختار؟",options:[{text:"أرتبها حسب الأثر والموعد والمخاطر",scores:{strategy:2,analysis:1}},{text:"أبدأ بالأقصر لإنهاء شيء بسرعة",scores:{action:1}},{text:"أطلب من الفريق توزيع المهام",scores:{people:2,strategy:1}},{text:"أبحث عن طريقة آلية تختصر الوقت",scores:{creation:1,exploration:1}}]},
  {prompt:"أخطأت في قرار اتخذته أمام الفريق. ما التصرف الأنسب؟",options:[{text:"أعترف بالخطأ وأوضح خطة التصحيح",scores:{people:1,action:1,analysis:1}},{text:"أنتظر حتى يكتشفه أحد",scores:{action:1}},{text:"أراجع سبب الخطأ وأحدث طريقة العمل",scores:{analysis:2,strategy:1}},{text:"أحمّل الظروف مسؤولية النتيجة",scores:{action:1}}]},
  {prompt:"اقترح زميل فكرة جيدة لكنها تحتاج اختبارًا قبل اعتمادها. ماذا تفعل؟",options:[{text:"أصمم تجربة محدودة بمقياس نجاح واضح",scores:{exploration:1,analysis:1,creation:1}},{text:"أعتمدها فورًا لأنها تبدو واعدة",scores:{action:1}},{text:"أرفضها لأنها لم تُستخدم سابقًا",scores:{analysis:1}},{text:"أجمع أصحاب العلاقة لتقييم أثرها",scores:{people:2,strategy:1}}]}
];

export const TESTS: FaslTest[] = [
  { id:"thinking", title:"كيف يعمل عقلك؟", description:"اختبار تفاعلي لأسلوبك الغالب في التفكير وحل المشكلات.", questions:thinking, results:generalResults },
  { id:"character", title:"أي شخصية تشبه في طريقة تفكيرك؟", description:"اكتشف النموذج الأقرب إليك من شخصيات القصص والأفلام، بناءً على اختياراتك لا على سؤال واحد.", questions:personality, results:generalResults },
  { id:"career", title:"أين يناسبك العمل؟", description:"تقييم استرشادي لميولك في بيئة العمل والأقسام التي قد تناسبك.", questions:career, results:generalResults },
  { id:"aptitude", title:"اختبار القدرات والاستدلال", description:"أسئلة قصيرة في المنطق والاستدلال العددي واللفظي. احصل على نتيجتك مع تفسير الإجابات.", questions:aptitude, results:generalResults, kind:"aptitude" },
  { id:"workplace", title:"محاكاة مواقف العمل", description:"مواقف شائعة في بيئة العمل لقياس أسلوبك في الحكم والتعامل مع الأولويات والتعاون.", questions:workplace, results:generalResults }
];

export function findTest(testId: string): FaslTest | undefined {
  return TESTS.find(test => test.id === testId);
}
export function scoreTest(test: FaslTest, answers: number[]) {
  const scores: Record<Axis, number> = { analysis:0, creation:0, action:0, people:0, strategy:0, exploration:0, organization:0 };
  answers.forEach((answer, index) => {
    const option = test.questions[index]?.options[answer];
    if (!option) return;
    for (const [axis, value] of Object.entries(option.scores) as [Axis, number][]) scores[axis] += value;
  });
  const ranked = (Object.entries(scores) as [Axis, number][]).sort((a,b)=>b[1]-a[1]);
  const correctCount = test.questions.reduce((count, question, index) => count + (question.correctIndex !== undefined && answers[index] === question.correctIndex ? 1 : 0), 0);
  return { scores, primary: ranked[0][0], secondary: ranked[1][0], correctCount, accuracy: test.questions.some(question => question.correctIndex !== undefined) ? Math.round(correctCount / test.questions.filter(question => question.correctIndex !== undefined).length * 100) : null };
}
export function careerDepartments(primary: Axis, secondary: Axis): string[] {
  const map: Record<Axis,string[]> = {
    analysis:["تحليل البيانات والبحوث","الجودة والتدقيق","التحقيق والامتثال"],
    creation:["التصميم والإبداع","تطوير المنتجات","المحتوى والتسويق الإبداعي"],
    action:["العمليات والتشغيل","إدارة المشاريع","الهندسة والتنفيذ"],
    people:["الموارد البشرية","التعليم والتدريب","خدمة العملاء والعلاقات"],
    strategy:["الإدارة والتخطيط","الاستشارات وتطوير الأعمال","إدارة المنتجات"],
    exploration:["البحث والتطوير","التقنية والتجارب","الصحافة والاستكشاف"],
    organization:["المحاسبة وإدارة السجلات","الامتثال والتدقيق الإجرائي","تنسيق العمليات وضبط الجودة"]
  };
  return [...map[primary], ...map[secondary].slice(0,1)];
}
