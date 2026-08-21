import { loadShareCard } from '@/lib/share';

/* Public. The middleware guards /hub and /onboarding and deliberately not
   this: the whole point of a share link is that it opens for a stranger. */
export const revalidate = 300;

export async function generateMetadata({ params }) {
  const { token } = await params;
  const card = await loadShareCard(token);

  if (!card) {
    return { title: 'Result withdrawn · NCBO', robots: { index: false } };
  }

  const title = `${card.athlete_name} · ${card.placing} · ${card.division}`;
  const description = `${card.show_name} · ${card.federation}${card.chapter ? ` · ${card.chapter}` : ''}`;
  const image = `/share/${token}/opengraph-image`;

  return {
    title,
    description,
    openGraph: {
      title, description, images: [{ url: image, width: 1080, height: 1920 }], type: 'article',
    },
    twitter: { card: 'summary_large_image', title, description, images: [image] },
  };
}

export default async function SharePage({ params }) {
  const { token } = await params;
  const card = await loadShareCard(token);

  if (!card) {
    return (
      <main className="mx-auto w-full max-w-[560px] px-6 py-24 text-center">
        <h1 className="font-display text-[2rem] font-extrabold uppercase leading-tight text-ink">
          This result was withdrawn.
        </h1>
        <p className="mt-5 text-[1.02rem] leading-relaxed text-body">
          The athlete or their club lead took it down. If you were sent this link recently, ask
          them for a new one.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-[560px] px-6 py-16">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/share/${token}/opengraph-image`}
        alt={`${card.athlete_name}, ${card.placing} in ${card.division} at ${card.show_name}`}
        width={1080}
        height={1920}
        className="w-full rounded-[12px] border border-edge"
      />

      <p className="mt-8 text-center text-[1.02rem] leading-relaxed text-body">
        {card.athlete_name} competed for {card.chapter || 'NCBO'} at {card.show_name}.
        {card.status === 'pending' && ' This result is waiting to be verified by their club lead.'}
      </p>

      <p className="mt-6 text-center">
        <a className="font-semibold text-brand underline underline-offset-2" href="/">
          National Collegiate Bodybuilding Organization
        </a>
      </p>
    </main>
  );
}
