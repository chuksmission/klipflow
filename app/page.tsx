import { metadata } from './homepage-metadata'
export { metadata }

import HomeClient from './HomeClient'
import { INTRO_SCRIPT } from './components/home/intro-script'
import { getSocialLinks } from './lib/social-links-server'

export default async function HomePage() {
  // Footer social icons: set in Admin → Site Settings
  const socialLinks = await getSocialLinks()
  return (
    <>
      {/* Decides before first paint whether the intro plays (first visit only) */}
      <script dangerouslySetInnerHTML={{ __html: INTRO_SCRIPT }} />
      <HomeClient socialLinks={socialLinks} />
    </>
  )
}
