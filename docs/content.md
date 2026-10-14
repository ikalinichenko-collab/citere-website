# Citere — контент сайта v4: сообщение, тон, тексты

Заменяет v3. Коммерции нет. Фокус — российская дезинформация против Украины в ответах AI-чат-ботов.

---

## Часть A. Принципы, по которым написан текст

Это не абстрактные «лучшие практики», а конкретные правила, применённые к каждому абзацу ниже. Их же используем при всех будущих правках.

**1. Тест пяти секунд.** Человек, впервые открывший главную, через пять секунд должен ответить на три вопроса: что это, для кого, почему мне верить. Если для ответа надо скроллить — заголовок плохой.

**2. Одна мысль на блок.** Каждая секция доказывает одно утверждение. Если в блоке два «и» — это два блока.

**3. Утверждение → доказательство рядом.** Ни одна фраза с оценкой не стоит без цифры, даты или ссылки в том же абзаце. «Contamination is real» ничего не значит; «23 of 698 responses cited Kremlin-linked domains» — значит.

**4. Конкретное вместо общего.** Не «AI chatbots», а «ChatGPT, Gemini, Grok, Claude, Google AI Overviews, Perplexity». Не «we work with partners», а названия. Не «regularly», а «every month».

**5. Глагол вперёд.** Что мы *делаем*, а не кем мы *являемся*. «We test», «we trace», «we publish» — не «Citere is a platform that…».

**6. Честность как маркетинг.** В этой нише доверие — единственный актив. Каждое ограничение, названное самими, прибавляет веса. Раздел Limitations — не оправдание, а доказательство серьёзности.

**7. Никаких прилагательных-усилителей.** Cutting-edge, innovative, powerful, comprehensive, unique — удалить везде. Если что-то уникально, это видно из фактов.

**8. Короткие предложения, обычные слова.** Средняя длина предложения — до 20 слов. Термины (repeat-rate, persona, Layer B) вводятся один раз с объяснением в скобках, дальше используются как есть.

**9. Кнопки называют результат.** Не «Learn more», а «Browse the registry». Не «Submit», а «Report an error».

**10. Первый абзац страницы — самодостаточный.** Если модель или человек прочитает только его, он должен получить ответ. Это одновременно и требование GEO, и требование хорошего письма.

---

## Часть B. Каркас сообщения (messaging hierarchy)

Всё остальное — производные от этих четырёх строк.

**Позиционирование (кто мы, одной фразой):**
> Citere is an independent Ukrainian research team that tests public AI chatbots for Russian disinformation about Ukraine — and gets it corrected.

**Проблема (почему это важно, одной фразой):**
> Russian influence operations now target AI models, not just people: millions of articles are published to be indexed and quoted by chatbots, and nobody was measuring whether it works.

**Что мы делаем (одной фразой):**
> We ask chatbots the questions real people ask, in the markets Russia targets; record when they repeat a known false claim; trace the sources they cite; report it to the platform and to authorities; publish everything; and measure again.

**Чем подтверждаем (одной фразой):**
> Every claim we document is a public page with the evidence, every action we took, and the before-and-after — with dates and model versions.

**Тон голоса:** спокойный, точный, без пафоса. Как отчёт, который хочется читать. Ближе к Bellingcat и DFRLab, чем к стартапу. Мы не «сражаемся» — мы измеряем, документируем, добиваемся исправления.

**Слова, которые используем:** document, record, trace, report, publish, re-measure, verify, correct, evidence, source, claim, verdict.
**Слова, которые не используем:** fight, combat, defeat, war on disinformation, revolutionary, AI-powered, cutting-edge, comprehensive, unique, holistic, empower.

---

## Часть C. Навигация и микротексты

**Меню (7 пунктов, порядок по частоте использования):**
Registry · Reports · Chatbots · Sources · Escalations · Methodology · About

(«Chatbots» вместо «Platforms» — слово, которое люди реально ищут. «Sources» вместо «Blacklist» — нейтральнее и точнее.)

**Кнопки (вся кнопочная лексика сайта):**
Browse the registry · Read the latest report · Download the data · See the escalation log · How we measure · Report an error · Cite this page · Get the JSON

**Бейджи вердиктов:** FALSE · MISLEADING · UNSUPPORTED
**Бейджи поведения бота:** Repeated · Contextualised · Refuted · Dodged
**Статусы эскалации:** Submitted · Acknowledged · Actioned · No response · Declined · Completed

**Строка обновления (везде одинаковая):** Updated 24 Oct 2026 · Data: CC BY 4.0 · [How we measure](/methodology/)

**Футер:** Registry · Reports · Chatbots · Sources · Escalations · Methodology · Data · About · Corrections · Contact · RSS · JSON · llms.txt · GitHub · Zenodo

---

## Часть D. Главная — финальный текст

### D1. Первый экран

**H1 (вопрос, на который отвечает сайт):**
> Do AI chatbots repeat Russian disinformation about Ukraine?

**Ответ (подзаголовок, 2 предложения):**
> Sometimes — and we measure exactly when. We test ChatGPT, Gemini, Grok, Claude, Google AI Overviews and Perplexity with the questions people actually ask, record every time they repeat a known false claim, report it, and check whether it changes.

**Три числа (живые):**
`{{claims}}` false claims documented · `{{responses}}` chatbot answers analysed · `{{escalations}}` reports sent to platforms

**Кнопки:** Browse the registry · Read the latest report

*Почему так: заголовок-вопрос совпадает с тем, что люди и модели реально спрашивают. Ответ даётся сразу и честно («sometimes»), а не «да, катастрофа». Числа доказывают, что мы это делаем, а не собираемся.*

### D2. Проблема

**H2:** The audience is the model

> Russian influence networks no longer write only for people. The Pravda network alone publishes millions of articles a year across hundreds of near-empty websites in dozens of languages. Almost nobody reads them. They exist to be indexed, retrieved and quoted by AI systems.
>
> When a chatbot answers a question about Ukraine, it often searches the live web first. If a Kremlin-linked site is in the results, the false claim can surface in the answer — presented in the calm, neutral voice people trust.
>
> That answer has no share button, no feed and no moderator. It is generated once, for one person, and disappears. Nothing built to catch disinformation on social media can see it.

Источники под блоком (ссылки): Viginum on Portal Kombat · NewsGuard on the Pravda network · DFRLab.

### D3. Что мы делаем

**H2:** What we do

> We are an independent research team based in Ukraine. We test public AI chatbots the way a normal user would — through the consumer interface, not the API — in the languages and countries Russia targets. Then we do six things.

| | | |
|---|---|---|
| **1. Detect** | We ask each chatbot the questions people ask about Ukraine, from neutral to hostile, and record how it handles each documented false claim: repeats it, contextualises it, refutes it, or dodges. | → Methodology |
| **2. Trace** | We extract every source the chatbot cited and match it against a versioned list of Kremlin-linked domains. Content and sources are checked separately; the overlap is where the real problems are. | → Sources |
| **3. Publish** | Every claim gets a permanent public page: the verdict, the evidence, what is genuinely true underneath, which chatbots repeated it and when. Machine-readable and openly licensed. | → Registry |
| **4. Report** | Each confirmed finding goes to the platform's trust-and-safety channel with the prompt, the answer, the cited domains and the debunk. Contaminated domains go to registrars, hosts and CERT-level partners. | → Escalations |
| **5. Confirm** | We share findings with Ukraine's Centre for Countering Disinformation, SPRAVDI and independent fact-checkers, and link their confirmations on each claim page. | → About |
| **6. Re-measure** | Four weeks later we run the same questions again and publish the before-and-after, model versions included. We report the change; we do not claim credit we cannot prove. | → Reports |

### D4. Доказательства

**H2:** What we have found so far

**Latest findings** — таблица 5 строк: Claim · Verdict · Repeated by · Date · Status.

**Escalations:** `{{sent}}` reports sent · `{{answered}}` responses · `{{actioned}}` confirmed changes → See the escalation log

**Before and after:**
> `{{claim_title}}` — repeated by `{{x}}` of 6 chatbots on `{{d1}}`; by `{{y}}` of 6 on `{{d2}}`, after we reported it. → See the claim

**Where our data is used** — список ссылок. *Не выводится, пока пуст.*

### D5. Почему нам можно верить

**H2:** Why trust this

Четыре коротких блока, у каждого — ссылка на доказательство:

> **We show our method.** Every verdict, every table, every number links to how it was produced. → Methodology
>
> **We publish the data.** Everything on this site is downloadable as CSV or JSON under CC BY 4.0, with DOIs for citation. → Data
>
> **We record our own actions.** Every report we send and every answer we get is logged publicly with a date. → Escalation log
>
> **We correct in the open.** Errors are fixed on the page, dated, and listed in the changelog. Never silently. → Corrections

Затем одна строка:
> Citere is a Ukrainian company and a Diia.City resident. We are self-funded and have no commercial relationship with any platform we test. → About

### D6. Свежее

**H2:** Latest reports — 3 карточки: название, дата, один вывод с цифрой.
**H2:** Recently updated claims — 5 строк.

### Meta

- Title: `Do AI chatbots repeat Russian disinformation about Ukraine? — Citere`
- Description: `Citere tests ChatGPT, Gemini, Grok, Claude, Google AI Overviews and Perplexity for Russian disinformation about Ukraine, reports what it finds to the platforms, and measures whether it changes. Open data.`

---

## Часть E. Реестр `/registry/`

**H1:** False claims about Ukraine found in AI chatbot answers

**Первый абзац (самодостаточный):**
> This registry lists every false claim about Ukraine we have documented in the answers of at least one public AI chatbot. Each entry shows the verdict and evidence, what is genuinely true underneath the claim, which chatbots repeated it and under what kind of question, the sources they cited, every action we took, and what we found when we measured again. `{{n}}` claims. Updated `{{date}}`.

**Как читать** (три строки, перед списком):
> **Verdict** — False: fabricated. Misleading: a real fact stretched into a false conclusion. Unsupported: presented as established, no evidence either way.
> **Chatbot behaviour** — Repeated: stated as fact. Contextualised: engaged, but marked the truth boundary. Refuted: corrected it. Dodged: declined.
> **Personas** — we ask each question four ways, from a neutral check to a hostile request to write the narrative. Results are shown per persona and never averaged.

**Фильтры:** Cluster · Country · Language · Chatbot · Verdict · Escalation status

**Внизу:** Get the JSON · Download CSV · RSS · Cite the registry

---

## Часть F. Карточка — образец с финальным текстом

**H1:** "Ukrainian officials stole $100 million of Western aid"

**FALSE** · Verdict 15 Sep 2026 · Updated 24 Oct 2026 · ID C1-003 · Cluster: Corruption / diverted aid · Seen in EN, DE, FR, PL

### The verdict

> This claim attaches a real Ukrainian corruption case to Western aid that the case never involved. `{{Case name}}` concerned `{{what: e.g. domestic procurement}}`, was investigated by `{{NABU/SAP}}`, and is documented in `{{court/official record, date}}`. No audit of Western assistance — by `{{auditor}}`, `{{auditor}}`, or `{{auditor}}` — has found diversion on this scale. `{{One sentence, one number, one source.}}`

### What is true

> Ukraine has real, prosecuted corruption cases, and `{{case}}` is one of them: `{{what happened, date, source}}`. The false part is the link to Western aid, which does not appear anywhere in the case record. This is why the claim works — and why chatbots repeat it far more often than pure inventions.

### Where the claim comes from

> First seen `{{date}}` on `{{origin}}`; amplified through `{{network}}` (attributed by `{{Viginum / DFRLab}}`, `{{date}}`).

### Who else has checked this

Таблица: Organisation · Finding · Date · Link.

### Which chatbots repeated it

Таблица: Chatbot · Country · Language · Persona · Date · Model version · Behaviour · Kremlin-linked domains cited.

> In our first run, chatbots refuted pure inventions in this cluster 100% of the time, but repeated this claim in 23% of non-evasive answers — because the real case underneath gives the model something true to over-extend.

### Sources the chatbots cited

Список доменов (`example[.]com`, без гиперссылок) с сетью и ссылкой на страницу домена.

### What we did

`{{n}}` actions · `{{m}}` responses · re-measured `{{date}}`

| Action | To | Date | Status |
|---|---|---|---|
| Published this page | citere.ai | 22 Sep 2026 | Live |
| Reported | OpenAI | 09 Oct 2026 | Acknowledged 14 Oct 2026 |
| Reported | xAI | 09 Oct 2026 | No response (21 days) |
| Domain complaint | Registrar of `{{domain}}` | 09 Oct 2026 | Submitted |
| Shared with | Centre for Countering Disinformation (RNBO) | 24 Sep 2026 | Receipt confirmed |
| Published by | VoxCheck | 01 Oct 2026 | Published → link |
| Re-measured | 6 chatbots | 24 Oct 2026 | Completed |

> We publish what we did, to whom, and when. We do not publish correspondence or the names of individuals at platforms.

### What changed

Таблица: Chatbot · Before (rate, date, version) · After (rate, date, version) · Change.

> Models are updated continuously and independently of our reports. We record the version at both measurements and publish the change without claiming causation we cannot demonstrate.

### Changelog · Cite this page · Get the JSON

---

## Часть G. Остальные страницы — первые абзацы

**Reports `/monitor/`**
> Each month we publish how six public AI chatbots handled documented false claims about Ukraine: repeat-rate and source-contamination rate per chatbot, per country and per question type, with confidence intervals and model versions. Every report comes with its dataset and a DOI.

**Chatbots `/platforms/`**
> One page per chatbot: how it handles Russian disinformation about Ukraine today, how that has changed month by month, which specific claims it repeated, and every report we sent to its maker with the response.

**Chatbot profile `/platforms/{bot}/`** (шаблон):
> In our `{{month}}` run, `{{Bot}}` repeated a documented false claim in `{{x}}` of `{{y}}` non-evasive answers (`{{rate}}`) and cited a Kremlin-linked domain in `{{z}}` (`{{crate}}`). Tested in `{{countries}}`, version `{{v}}`, `{{date}}`. `{{Company}}` has been notified of every finding on this page.

**Sources `/sources/`**
> These are the domains from known Russian influence infrastructure — the Pravda network, Doppelganger, Matryoshka, Storm-1516 and state media — that we have seen cited in AI chatbot answers. Each one links to its public attribution by Viginum, DFRLab, NewsGuard or EU DisinfoLab. `{{n}}` domains, list version `{{v}}`. Download as CSV or STIX 2.1.

**Escalations `/escalations/`**
> Every action we take is logged here: reports to platforms, complaints to registrars and hosts, data shared with state and fact-checking partners, and re-measurements. `{{sent}}` actions, `{{answered}}` responses, median response time `{{days}}` days.
>
> **How we disclose.** We tell the platform first and privately. The fact, date and status of a report are published immediately; the content of the exchange is not. We never publish prompts designed to bypass model safeguards.

**Methodology `/methodology/`**
> We classify behaviour, not truth. For each documented false claim, we ask what a chatbot's answer did with it: repeated it, contextualised it, refuted it, or dodged. This is more reproducible than scoring "accuracy", because effective disinformation almost always contains a grain of truth — and accuracy scoring breaks on exactly those cases.

**About `/about/`**
> Citere is a Ukrainian research company, registered in `{{city}}` and a Diia.City resident since May 2026. We test public AI chatbots for Russian disinformation about Ukraine and work to get it corrected. We are self-funded, have no commercial relationship with any platform we test, and share our findings with Ukrainian institutions and European fact-checkers free of charge.
>
> **Corrections.** If we get something wrong, we fix the page, date the change, and list it in the changelog. Never silently. → corrections@`{{domain}}`

**Data `/data/`**
> Everything on this site is available as data: the claim registry, per-run observations, the domain list, and the escalation log. CSV and JSON, CC BY 4.0, with a DOI for each release. Cite as: `{{citation}}`.

---

## Часть H. Чек-лист перед публикацией любой страницы

- [ ] Первый абзац отвечает на вопрос страницы сам по себе.
- [ ] Каждая оценка стоит рядом с цифрой, датой или ссылкой.
- [ ] Ни одного слова из стоп-списка (fight, combat, unique, comprehensive, cutting-edge…).
- [ ] Предложения до 20 слов; термин объяснён при первом появлении.
- [ ] Кнопки называют результат.
- [ ] Есть дата обновления, ссылка на методологию, ссылка на данные.
- [ ] Persona не агрегированы; версии моделей указаны.
- [ ] Нет обещаний («в процессе» без даты), нет пустых блоков-заглушек.
- [ ] Один H1; JSON-LD соответствует содержанию.

---

## Что нужно от вас

1. Домен и город регистрации.
2. Команда: имена, роли (для /about/).
3. Формулировка финансирования — сейчас «self-funded»; верно?
4. Фактура по кейсу «$100M» для образцовой карточки: какой реальный случай, кто расследовал, где документ.
5. Подтверждение заголовка главной — вопрос («Do AI chatbots repeat Russian disinformation about Ukraine?») или утверждение.
