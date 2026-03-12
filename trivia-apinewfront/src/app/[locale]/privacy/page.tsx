import { getTranslations } from 'next-intl/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { loadLegalDocument, type LegalBlock } from '@/lib/legalContent';

function renderBlock(block: LegalBlock, index: number) {
  switch (block.type) {
    case 'heading':
      return (
        <h2 key={index} className='text-base font-semibold text-foreground'>
          {block.text}
        </h2>
      );
    case 'quote':
      return (
        <blockquote key={index} className='border-l-2 border-border pl-3 text-sm text-muted-foreground italic'>
          {block.text}
        </blockquote>
      );
    case 'list':
      return block.ordered ? (
        <ol key={index} className='list-decimal space-y-1 pl-5 text-sm leading-6 text-foreground'>
          {block.items.map((item, itemIndex) => (
            <li key={itemIndex}>{item}</li>
          ))}
        </ol>
      ) : (
        <ul key={index} className='list-disc space-y-1 pl-5 text-sm leading-6 text-foreground'>
          {block.items.map((item, itemIndex) => (
            <li key={itemIndex}>{item}</li>
          ))}
        </ul>
      );
    case 'paragraph':
      return (
        <p key={index} className='text-sm leading-6 text-foreground'>
          {block.text}
        </p>
      );
    default:
      return null;
  }
}

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const tLegal = await getTranslations({ locale, namespace: 'legal' });
  const legal = await loadLegalDocument('privacy', locale);

  return (
    <main className='container max-w-3xl mx-auto px-4 py-10'>
      <Card>
        <CardHeader>
          <CardTitle>{legal.title}</CardTitle>
          <p className='text-sm text-muted-foreground'>{tLegal('version', { version: legal.version })}</p>
        </CardHeader>
        <CardContent className='space-y-4'>
          {legal.blocks.map((block, index) => renderBlock(block, index))}
        </CardContent>
      </Card>
    </main>
  );
}

