import { useState, useEffect } from 'react';
import en from '../app/locales/en.json';
import pt from '../app/locales/pt.json';

type Locale = 'en' | 'pt';
type Translations = typeof en;

export function useTranslation() {
    const [locale, setLocale] = useState<Locale>('en');

    useEffect(() => {
        // Basic detection
        const browserLang = navigator.language.toLowerCase();
        if (browserLang.startsWith('pt')) {
            setLocale('pt');
        } else {
            setLocale('en');
        }
    }, []);

    const t = (key: keyof Translations) => {
        const translations = locale === 'pt' ? pt : en;
        return translations[key] || key;
    };

    return { t, locale };
}
