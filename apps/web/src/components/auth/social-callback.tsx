'use client';

import { HandleSSOCallback } from '@clerk/nextjs';

export function SocialCallback() {
  return <HandleSSOCallback
    navigateToApp={({ session, decorateUrl }) => { window.location.replace(decorateUrl(session?.currentTask ? '/social-sign-in/tasks' : '/home')); }}
    navigateToSignIn={() => { window.location.replace('/social-sign-in'); }}
    navigateToSignUp={() => { window.location.replace('/social-sign-up'); }}
  />;
}
