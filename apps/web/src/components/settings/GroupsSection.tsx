import { hubAvailable } from '../../hub/client';
import { useT } from '../../i18n';
import { GroupsConsent, WipeGroupsSection } from '../groups/GroupsConsent';
import '../../groups.css';

/** Privacy options of the friend groups; the Groups screen only links here. */
export function GroupsSection() {
  const t = useT();
  if (!hubAvailable()) return null;
  return (
    <>
      <h2 className="section-title">{t('groups.settings.section')}</h2>
      <GroupsConsent />
      <WipeGroupsSection />
    </>
  );
}
