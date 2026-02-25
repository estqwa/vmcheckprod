'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/providers/AuthProvider';
import { GoogleCodeAuthButton } from '@/components/auth/GoogleCodeAuthButton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { UserPlus } from 'lucide-react';
import type { RegisterData } from '@/lib/api/types';

export default function RegisterPage() {
    const router = useRouter();
    const { register, isLoading } = useAuth();
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [birthDate, setBirthDate] = useState('');
    const [gender, setGender] = useState<RegisterData['gender'] | ''>('');
    const [tosAccepted, setTosAccepted] = useState(false);
    const [privacyAccepted, setPrivacyAccepted] = useState(false);

    const t = useTranslations('auth');
    const tCommon = useTranslations('common');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (password !== confirmPassword) {
            toast.error(t('passwordMismatch') || 'Passwords do not match');
            return;
        }

        if (password.length < 6) {
            toast.error(t('passwordTooShort') || 'Password must be at least 6 characters');
            return;
        }

        if (!tosAccepted || !privacyAccepted) {
            toast.error(t('acceptTerms') || 'You must accept Terms of Service and Privacy Policy');
            return;
        }
        if (!birthDate) {
            toast.error(t('birthDateRequired') || 'Date of birth is required');
            return;
        }
        if (!gender) {
            toast.error(t('genderRequired') || 'Please select your gender');
            return;
        }

        try {
            const registerData: RegisterData = {
                username,
                email,
                password,
                first_name: firstName,
                last_name: lastName,
                birth_date: birthDate,
                gender,
                tos_accepted: tosAccepted,
                privacy_accepted: privacyAccepted,
            };
            await register(registerData);
            toast.success(t('registerSuccess') || 'Account created!');
            router.push('/verify-email');
        } catch (error: unknown) {
            const err = error as { error?: string };
            toast.error(err.error || t('registerError'));
        }
    };

    return (
        <div className="min-h-app flex flex-col">
            {/* Header */}
            <header className="border-b border-border/50 bg-white/80 backdrop-blur-sm">
                <div className="container max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
                            <span className="text-white font-bold text-lg">Q</span>
                        </div>
                        <span className="font-bold text-xl text-foreground">QazaQuiz</span>
                    </Link>
                    <LanguageSwitcher />
                </div>
            </header>

            {/* Main */}
            <main className="flex-1 flex items-center justify-center px-4 py-12">
                <Card className="w-full max-w-lg card-elevated border-0 rounded-2xl">
                    <CardHeader className="text-center pb-2">
                        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                            <UserPlus className="w-8 h-8 text-primary" />
                        </div>
                        <CardTitle className="text-2xl">{t('register')}</CardTitle>
                        <CardDescription>{t('registerDescription') || 'Create your account'}</CardDescription>
                    </CardHeader>
                    <form onSubmit={handleSubmit}>
                        <CardContent className="space-y-4">
                            {/* Row: First + Last name */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-2">
                                    <Label htmlFor="firstName">{t('firstName') || 'First Name'}</Label>
                                    <Input
                                        id="firstName"
                                        type="text"
                                        value={firstName}
                                        onChange={(e) => setFirstName(e.target.value)}
                                        required
                                        minLength={1}
                                        maxLength={100}
                                        className="h-12"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="lastName">{t('lastName') || 'Last Name'}</Label>
                                    <Input
                                        id="lastName"
                                        type="text"
                                        value={lastName}
                                        onChange={(e) => setLastName(e.target.value)}
                                        required
                                        minLength={1}
                                        maxLength={100}
                                        className="h-12"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="username">{t('username')}</Label>
                                <Input
                                    id="username"
                                    type="text"
                                    placeholder="YourNickname"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    required
                                    minLength={3}
                                    maxLength={50}
                                    className="h-12"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="email">{t('email')}</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="you@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    className="h-12"
                                />
                            </div>
                            {/* Row: Birth date + Gender */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-2">
                                    <Label htmlFor="birthDate">{t('birthDate') || 'Date of Birth'}</Label>
                                    <Input
                                        id="birthDate"
                                        type="date"
                                        value={birthDate}
                                        onChange={(e) => setBirthDate(e.target.value)}
                                        required
                                        className="h-12"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="gender">{t('gender') || 'Gender'}</Label>
                                    <select
                                        id="gender"
                                        value={gender}
                                        onChange={(e) => setGender(e.target.value as RegisterData['gender'] | '')}
                                        required
                                        className="h-12 w-full rounded-md border border-input bg-background px-3 text-sm"
                                    >
                                        <option value="">{t('selectGender') || 'Select...'}</option>
                                        <option value="male">{t('genderMale') || 'Male'}</option>
                                        <option value="female">{t('genderFemale') || 'Female'}</option>
                                        <option value="other">{t('genderOther') || 'Other'}</option>
                                        <option value="prefer_not_to_say">{t('genderPreferNot') || 'Prefer not to say'}</option>
                                    </select>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="password">{t('password')}</Label>
                                <Input
                                    id="password"
                                    type="password"
                                    placeholder="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    minLength={6}
                                    className="h-12"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="confirmPassword">{t('confirmPassword')}</Label>
                                <Input
                                    id="confirmPassword"
                                    type="password"
                                    placeholder="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required
                                    className="h-12"
                                />
                            </div>
                            {/* Legal checkboxes */}
                            <div className="space-y-3 pt-2">
                                <label className="flex items-start gap-2 text-sm cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={tosAccepted}
                                        onChange={(e) => setTosAccepted(e.target.checked)}
                                        className="mt-0.5"
                                        required
                                    />
                                    <span className="text-muted-foreground">
                                        {t('acceptTos') || 'I accept the Terms of Service'}{' '}
                                        <Link href="/terms" className="underline underline-offset-2 hover:text-foreground">
                                            {t('termsLink') || 'Terms'}
                                        </Link>
                                    </span>
                                </label>
                                <label className="flex items-start gap-2 text-sm cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={privacyAccepted}
                                        onChange={(e) => setPrivacyAccepted(e.target.checked)}
                                        className="mt-0.5"
                                        required
                                    />
                                    <span className="text-muted-foreground">
                                        {t('acceptPrivacy') || 'I accept the Privacy Policy'}{' '}
                                        <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">
                                            {t('privacyLink') || 'Privacy Policy'}
                                        </Link>
                                    </span>
                                </label>
                            </div>
                        </CardContent>
                        <CardFooter className="flex flex-col gap-4">
                            <Button type="submit" className="w-full h-12 btn-coral text-base" disabled={isLoading}>
                                {isLoading ? tCommon('loading') : t('registerButton')}
                            </Button>
                            <GoogleCodeAuthButton
                                label={t('googleRegister') || 'Continue with Google'}
                                action="register"
                                returnPath="/"
                                className="w-full h-12"
                                disabled={isLoading}
                                onError={(message) => toast.error(message)}
                            />
                            <p className="text-sm text-muted-foreground text-center">
                                {t('hasAccount')}{' '}
                                <Link href="/login" className="text-primary hover:underline font-medium">
                                    {t('loginButton')}
                                </Link>
                            </p>
                        </CardFooter>
                    </form>
                </Card>
            </main>
        </div>
    );
}
