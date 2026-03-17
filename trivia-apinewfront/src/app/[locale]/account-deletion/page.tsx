import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const CONTENT = {
  ru: {
    title: 'Удаление аккаунта QazaQuiz',
    intro:
      'Пользователь может удалить аккаунт прямо в мобильном приложении или отправить внешний запрос на удаление через email. Эта страница предназначена для публикации в Google Play как web link resource для account deletion request.',
    stepsTitle: 'Как запросить удаление аккаунта',
    steps: [
      'Откройте приложение QazaQuiz и перейдите в Профиль -> Удалить аккаунт.',
      'Если у вас нет доступа к приложению, отправьте запрос с email, привязанного к аккаунту, на privacy@qazaquiz.online.',
      'В теме письма укажите: "Account deletion request".',
      'В письме укажите username, email аккаунта и просьбу удалить аккаунт и связанные персональные данные.',
      'При необходимости мы можем запросить подтверждение владения аккаунтом для защиты от несанкционированного удаления.',
    ],
    processingTitle: 'Что происходит после запроса',
    processing: [
      'Доступ к аккаунту прекращается, активные сессии отзываются.',
      'Персональные данные удаляются или обезличиваются, если их дальнейшее хранение не требуется по закону, для антифрод-защиты, разрешения споров, учета призов или информационной безопасности.',
      'Агрегированные обезличенные статистические данные могут быть сохранены.',
    ],
    operatorTitle: 'Оператор сервиса',
    operator:
      'ТОО «Saizhan Supply & Services», БИН 210740013307, Казахстан, Мангистауская область, г. Актау, микрорайон 4А, д. 48.',
    contactsTitle: 'Контакты',
    privacy: 'privacy@qazaquiz.online',
    legal: 'legal@qazaquiz.online',
    support: 'support@qazaquiz.online',
    legalLink: 'Открыть политику конфиденциальности',
  },
  kk: {
    title: 'QazaQuiz аккаунтын жою',
    intro:
      'Пайдаланушы аккаунтын мобильді қосымша ішінде жоя алады немесе email арқылы сыртқы жою сұрауын жібере алады. Бұл бет Google Play үшін account deletion request web link resource ретінде жариялауға арналған.',
    stepsTitle: 'Аккаунтты жоюды қалай сұратуға болады',
    steps: [
      'QazaQuiz қосымшасын ашып, Профиль -> Аккаунтты жою бөліміне өтіңіз.',
      'Егер қосымшаға қол жеткізе алмасаңыз, аккаунтқа байланған email арқылы privacy@qazaquiz.online адресіне сұрау жіберіңіз.',
      'Хат тақырыбында: "Account deletion request" деп көрсетіңіз.',
      'Хат ішінде username, аккаунт email адресі және аккаунт пен байланысты дербес деректерді жою туралы өтінішті көрсетіңіз.',
      'Рұқсатсыз жоюдың алдын алу үшін біз аккаунт иелігін растауды сұрата аламыз.',
    ],
    processingTitle: 'Сұраудан кейін не болады',
    processing: [
      'Аккаунтқа қолжетімділік тоқтатылады, белсенді сессиялар жабылады.',
      'Дербес деректер заң, антифрод қорғау, дауларды шешу, жүлделер есебі немесе ақпараттық қауіпсіздік үшін сақтау талап етілмесе, жойылады немесе жасырындандырылады.',
      'Агрегатталған жасырын статистикалық деректер сақталуы мүмкін.',
    ],
    operatorTitle: 'Сервис операторы',
    operator:
      'ТОО «Saizhan Supply & Services», БСН 210740013307, Қазақстан, Маңғыстау облысы, Ақтау қ., 4А шағын ауданы, 48-үй.',
    contactsTitle: 'Байланыстар',
    privacy: 'privacy@qazaquiz.online',
    legal: 'legal@qazaquiz.online',
    support: 'support@qazaquiz.online',
    legalLink: 'Құпиялық саясатын ашу',
  },
} as const;

export default async function AccountDeletionPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const content = locale === 'kk' ? CONTENT.kk : CONTENT.ru;

  return (
    <main className='container mx-auto max-w-3xl px-4 py-10'>
      <Card>
        <CardHeader>
          <CardTitle>{content.title}</CardTitle>
        </CardHeader>
        <CardContent className='space-y-6 text-sm leading-6 text-foreground'>
          <p>{content.intro}</p>

          <section className='space-y-3'>
            <h2 className='text-base font-semibold'>{content.stepsTitle}</h2>
            <ol className='list-decimal space-y-1 pl-5'>
              {content.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </section>

          <section className='space-y-3'>
            <h2 className='text-base font-semibold'>{content.processingTitle}</h2>
            <ul className='list-disc space-y-1 pl-5'>
              {content.processing.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          <section className='space-y-2'>
            <h2 className='text-base font-semibold'>{content.operatorTitle}</h2>
            <p>{content.operator}</p>
          </section>

          <section className='space-y-2'>
            <h2 className='text-base font-semibold'>{content.contactsTitle}</h2>
            <ul className='list-disc space-y-1 pl-5'>
              <li>
                privacy: <a className='underline underline-offset-2' href={`mailto:${content.privacy}`}>{content.privacy}</a>
              </li>
              <li>
                legal: <a className='underline underline-offset-2' href={`mailto:${content.legal}`}>{content.legal}</a>
              </li>
              <li>
                support: <a className='underline underline-offset-2' href={`mailto:${content.support}`}>{content.support}</a>
              </li>
            </ul>
          </section>

          <Link className='inline-flex text-sm font-medium underline underline-offset-2' href='/privacy'>
            {content.legalLink}
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
