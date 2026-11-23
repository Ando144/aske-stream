import { useState } from 'react';
import { useT } from '../../i18n';
import { useGroups } from '../../stores/groups';
import { confirmDialog } from '../../stores/ui';
import { HelpButton } from '../HelpSheet';
import { Sheet } from '../Sheet';

export function ConsentSheet({
  onAccept,
  onDecline,
}: {
  onAccept: () => void;
  onDecline: () => void;
}) {
  const t = useT();
  return (
    <Sheet onClose={onDecline} label={t('groups.consent.title')}>
      <div className="sheet-body">
        <h2>{t('groups.consent.title')}</h2>
        <p className="muted">{t('groups.consent.body')}</p>
        <HelpButton id="friend-groups" />
        <div className="row wrap">
          <button className="btn primary" onClick={onAccept}>
            {t('groups.consent.accept')}
          </button>
          <button className="btn" onClick={onDecline}>
            {t('groups.consent.decline')}
          </button>
        </div>
      </div>
    </Sheet>
  );
}

/** The switch for sharing listening stats; groups themselves never depend on it. */
export function GroupsConsent() {
  const t = useT();
  const consent = useGroups((s) => s.consent);
  const [asking, setAsking] = useState(false);

  const change = async (on: boolean) => {
    if (on) return setAsking(true);
    const ok = await confirmDialog(
      `${t('groups.consent.offTitle')} ${t('groups.consent.offBody')}`,
      t('groups.consent.offConfirm'),
    );
    if (ok) await useGroups.getState().setSharing(false);
  };

  return (
    <div className="panel groups-consent">
      <div className="setting">
        <label className="grow" htmlFor="groups-consent">
          <div>{t('groups.consent.label')}</div>
          <div className="faint small">{t('groups.consent.hint')}</div>
        </label>
        <span className="toggle">
          <input
            id="groups-consent"
            type="checkbox"
            role="switch"
            checked={consent === 'on'}
            onChange={(e) => void change(e.target.checked)}
          />
          <span />
        </span>
      </div>
      {asking && (
        <ConsentSheet
          onAccept={() => {
            setAsking(false);
            void useGroups.getState().setSharing(true);
          }}
          onDecline={() => setAsking(false)}
        />
      )}
    </div>
  );
}

/** Leaves every group and deletes everything kept about this person in the Hub. */
export function WipeGroupsSection() {
  const t = useT();
  const wipe = async () => {
    if (await confirmDialog(t('groups.wipe.confirm'), t('groups.wipe.confirmLabel'), true)) {
      await useGroups.getState().wipeAll();
    }
  };
  return (
    <section className="groups-wipe">
      <h2 className="section-title">{t('groups.wipe.title')}</h2>
      <p className="muted small">{t('groups.wipe.text')}</p>
      <button className="btn danger" onClick={() => void wipe()}>
        {t('groups.wipe.button')}
      </button>
    </section>
  );
}
