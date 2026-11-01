import { createContext, useContext, type PropsWithChildren } from 'react';
import type { NavigationType } from './useRouter';

const NavigationExperienceContext = createContext<NavigationType>('initial');

export function NavigationExperienceProvider({
  navigationType,
  children,
}: PropsWithChildren<{ navigationType: NavigationType }>) {
  return (
    <NavigationExperienceContext.Provider value={navigationType}>
      {children}
    </NavigationExperienceContext.Provider>
  );
}

export function useNavigationExperience() {
  return useContext(NavigationExperienceContext);
}
