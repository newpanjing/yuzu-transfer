import { ArrowRight, Route, ServerCog, Smartphone, Wifi } from 'lucide-react';
import { useI18n } from '../lib/i18n';

const TUTORIAL_STEPS = [
  { key: 'tutorial.step1', icon: Smartphone },
  { key: 'tutorial.step2', icon: Route },
  { key: 'tutorial.step3', icon: Wifi },
] as const;

const TUTORIAL_MODES = [
  { key: 'tutorial.mode.p2p', icon: Wifi },
  { key: 'tutorial.mode.relay', icon: ServerCog },
] as const;

export function TutorialView() {
  const { t } = useI18n();

  return (
    <main className="connect-view tutorial-view">
      <div className="view-heading">
        <h1>{t('tutorial.title')}</h1>
        <p>{t('tutorial.subtitle')}</p>
      </div>

      <div className="tutorial-layout">
        <section className="settings-panel tutorial-panel">
          <div className="settings-section-title">
            <h2>{t('tutorial.flowTitle')}</h2>
            <p>{t('tutorial.flowSubtitle')}</p>
          </div>

          <div className="tutorial-step-list">
            {TUTORIAL_STEPS.map(({ key, icon: Icon }, index) => (
              <article key={key} className="tutorial-step-card">
                <div className="tutorial-step-icon">
                  <Icon size={18} />
                </div>
                <div className="tutorial-step-copy">
                  <strong>{t(`${key}.title`)}</strong>
                  <p>{t(`${key}.body`)}</p>
                </div>
                {index < TUTORIAL_STEPS.length - 1 ? <ArrowRight className="tutorial-step-arrow" size={16} /> : null}
              </article>
            ))}
          </div>
        </section>

        <section className="settings-panel tutorial-panel">
          <div className="settings-section-title">
            <h2>{t('tutorial.modeTitle')}</h2>
            <p>{t('tutorial.modeSubtitle')}</p>
          </div>

          <div className="tutorial-mode-list">
            {TUTORIAL_MODES.map(({ key, icon: Icon }) => (
              <article key={key} className="tutorial-mode-card">
                <div className="tutorial-mode-head">
                  <div className="tutorial-step-icon">
                    <Icon size={18} />
                  </div>
                  <strong>{t(`${key}.title`)}</strong>
                </div>
                <p>{t(`${key}.body`)}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
