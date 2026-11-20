import { ChevronRight, BarChart3, Trash2 } from 'lucide-react';
import { Link } from 'wouter';
import { useT } from '../../i18n';
import { useStats } from '../../stores/stats';
import { confirmDialog, toast } from '../../stores/ui';

export function StatsSettingsPanel() {
  const t = useT();
  const enabled = useStats((s) => s.consent === 'on');

  async function onToggle(on: boolean) {
    if (on) {
      await useStats.getState().setEnabled(true);
      return;
    }
    // Turning off deletes the history, so ask first; cancelling leaves the switch on.
    if (
      await confirmDialog(
        t('stats.settings.disableConfirm'),
        t('stats.settings.disableButton'),
        true,
      )
    ) {
      await useStats.getState().setEnabled(false);
    }
  }

  async function onClear() {
    if (
      !(await confirmDialog(
        t('stats.settings.clearConfirm'),
        t('stats.settings.clearButton'),
        true,
      ))
    ) {
      return;
    }
    if (await useStats.getState().clearHistory()) toast(t('stats.cleared'));
  }

  return (
    <div className="panel">
      <Link href="/recap" className="setting setting-link">
        <BarChart3 size={20} className="muted" />
        <div className="grow">
          <div>{t('stats.settings.open')}</div>
          <div className="faint small">{t('stats.settings.openHint')}</div>
        </div>
        <ChevronRight size={20} className="faint" />
      </Link>
      <div className="setting">
        <label className="grow" htmlFor="stats-enable">
          <div>{t('stats.settings.enable')}</div>
          <div className="faint small">{t('stats.settings.enableHint')}</div>
        </label>
        <span className="toggle">
          <input
            id="stats-enable"
            type="checkbox"
            role="switch"
            checked={enabled}
            onChange={(e) => void onToggle(e.target.checked)}
          />
          <span />
        </span>
      </div>
      {enabled && (
        <div className="setting">
          <Trash2 size={20} className="muted" />
          <div className="grow">
            <div>{t('stats.settings.clear')}</div>
            <div className="faint small">{t('stats.settings.clearHint')}</div>
          </div>
          <button className="btn small danger" onClick={() => void onClear()}>
            {t('stats.settings.clearButton')}
          </button>
        </div>
      )}
    </div>
  );
}
