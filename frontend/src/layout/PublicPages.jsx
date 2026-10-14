import { Icon } from '../ui.jsx';
import { planUrl } from '../planning/navigation.js';
import { executionProgress, currentPeriod } from '../domain.js';
import { targetDistribution } from '../planning/selectors.js';
import { DistributionChart } from '../planning/Charts.jsx';
import { useTranslation } from '../i18n/context.jsx';

export function PublicHome({ plans }) {
  const { t } = useTranslation();
  return <div className="page public-home"><section className="public-intro"><p className="eyebrow">{t('publicHome.eyebrow')}</p><h1>{t('publicHome.title')}</h1><p>{t('publicHome.lead')}</p><a className="br-button primary" href="#/planejamentos">{t('publicHome.consultPlans')} <Icon name="arrow" size={16} /></a></section><section className="public-plans" aria-labelledby="public-plans-title"><div className="section-heading"><div><h2 id="public-plans-title">{t('publicHome.publishedTitle')}</h2><p>{t('publicHome.publishedLead')}</p></div><a className="text-button" href="#/planejamentos">{t('publicHome.seeAll')} <Icon name="arrow" size={14} /></a></div>{plans.length ? <div className="plan-grid">{plans.map((plan) => { const progress = executionProgress({ actions: plan.items.flatMap((item) => item.actions) }); return <article className="br-card public-plan-card" key={plan.id}><div className="card-content"><div className="public-plan-identity"><span className={`plan-icon ${plan.type.toLowerCase()}`} aria-hidden="true"><Icon name={plan.type === 'PLS' ? 'leaf' : 'book'} size={24} /></span><span>{plan.start}–{plan.end}</span></div><h3><a href={`#${planUrl(plan.id)}`}>{plan.shortName}</a></h3><p>{plan.name}</p><dl className="public-plan-facts"><div><dt>{t('publicHome.axes')}</dt><dd>{plan.axes.length}</dd></div><div><dt>{t('publicHome.stageExecution')}</dt><dd>{progress.total ? `${progress.percent}%` : t('publicHome.noData')}</dd></div></dl>{!!progress.total && <p className="hint">{t('publicHome.doneOfTotal', { done: progress.done, total: progress.total })}</p>}</div><div className="card-footer"><a className="br-button tertiary" href={`#${planUrl(plan.id)}`}>{t('publicHome.consultPlan')} {plan.shortName} <Icon name="arrow" size={16} /></a></div></article>; })}</div> : <div className="br-message info"><div className="content"><strong>{t('publicHome.noPlans')}</strong><p>{t('publicHome.noPlansHint')}</p></div></div>}</section><section className="public-orientation" aria-labelledby="public-guide-title"><h2 id="public-guide-title">{t('publicHome.howTitle')}</h2><div><article><Icon name="book" size={22} /><h3>{t('publicHome.step1Title')}</h3><p>{t('publicHome.step1Text')}</p></article><article><Icon name="layers" size={22} /><h3>{t('publicHome.step2Title')}</h3><p>{t('publicHome.step2Text')}</p></article><article><Icon name="chart" size={22} /><h3>{t('publicHome.step3Title')}</h3><p>{t('publicHome.step3Text')}</p></article></div></section></div>;
}

// Resumo visual de metas (atingimento de indicadores no período corrente),
// um por plano — compartilhado entre a home pública e a home autenticada.
export function PlanTargetsSummary({ plans }) {
  const { t } = useTranslation();
  return <section className="public-plans" aria-labelledby="public-targets-title"><div className="section-heading"><div><h2 id="public-targets-title">{t('targetsSummary.title')}</h2><p>{t('targetsSummary.lead')}</p></div></div><div className="dashboard-grid">{plans.map((plan) => <DistributionChart key={plan.id} title={`${t('targetsSummary.chartTitle')} · ${plan.shortName} (${currentPeriod(plan)})`} description={t('targetsSummary.chartDescription')} values={targetDistribution(plan.items, currentPeriod(plan), plan)} noun="indicadores" />)}</div></section>;
}

function useContent() {
  const { t } = useTranslation();
  return {
    '/sobre': {
      title: t('about.title'),
      lead: t('about.lead'),
      sections: [
        [t('about.s1Title'), t('about.s1Text')],
        [t('about.s2Title'), t('about.s2Text')],
        [t('about.s3Title'), t('about.s3Text')],
        [t('about.s4Title'), t('about.s4Text')],
      ],
    },
    '/ajuda': {
      title: t('help.title'),
      lead: t('help.lead'),
      sections: [
        [t('help.s1Title'), t('help.s1Text')],
        [t('help.s2Title'), t('help.s2Text')],
        [t('help.s3Title'), t('help.s3Text')],
        [t('help.s4Title'), t('help.s4Text')],
        [t('help.s5Title'), t('help.s5Text')],
      ],
    },
    '/privacidade': {
      title: t('privacy.title'),
      lead: t('privacy.lead'),
      sections: [
        [t('privacy.s1Title'), t('privacy.s1Text')],
        [t('privacy.s2Title'), t('privacy.s2Text')],
        [t('privacy.s3Title'), t('privacy.s3Text')],
        [t('privacy.s4Title'), t('privacy.s4Text')],
      ],
    },
    // Conteúdo institucional (menu "Institucional" da área de trabalho) — só em
    // português por ora, diferente das demais páginas desta lista.
    '/legislacao': {
      title: 'Legislação',
      lead: 'Normas institucionais que orientam o planejamento da UFCG.',
      sections: [
        ['Plano de Desenvolvimento Institucional (PDI)', 'O PDI 2026–2030 foi instituído pela Resolução nº 09/2025 do Colegiado Pleno da UFCG, que define os objetivos, iniciativas, indicadores, metas e ações do plano.'],
        ['Outras normas', 'Outras resoluções e normativos institucionais relacionados aos planos acompanhados pelo SUMI serão listados aqui conforme disponibilizados.'],
      ],
    },
    '/resolucoes': {
      title: 'Resoluções',
      lead: 'Atos normativos que instituem os planos acompanhados pelo SUMI.',
      sections: [
        ['PDI 2026–2030', 'Instituído pela Resolução nº 09/2025 do Colegiado Pleno da UFCG.'],
        ['PLS 2025–2030', 'Resolução de instituição a confirmar e incluir aqui.'],
      ],
    },
  };
}

export function InformationPage({ path }) {
  const { t } = useTranslation();
  const content = useContent();
  const page = content[path];
  return <div className="page information-page"><div className="page-heading"><div><h1>{page.title}</h1><p>{page.lead}</p></div></div>{page.sections.map(([title, text]) => <section key={title}><h2>{title}</h2><p>{text}</p></section>)}<a className="br-button secondary" href="#/planejamentos">{t('publicHome.consultPlans')} <Icon name="arrow" size={16} /></a></div>;
}
