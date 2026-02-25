import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function PrivacyPage() {
    const version = process.env.NEXT_PUBLIC_LEGAL_PRIVACY_VERSION || '1.0';

    return (
        <main className="container max-w-3xl mx-auto px-4 py-10">
            <Card>
                <CardHeader>
                    <CardTitle>Privacy Policy</CardTitle>
                    <p className="text-sm text-muted-foreground">Version {version}</p>
                </CardHeader>
                <CardContent className="space-y-4 text-sm leading-6 text-muted-foreground">
                    <p>We process account, gameplay, device, and security metadata to operate the service, prevent abuse, and support prize distribution.</p>
                    <p>Email verification and authentication providers may be used to confirm account ownership and secure sign-in.</p>
                    <p>This page is a rollout placeholder. Replace with approved privacy policy text before production launch and store submission.</p>
                </CardContent>
            </Card>
        </main>
    );
}

