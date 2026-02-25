import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function TermsPage() {
    const version = process.env.NEXT_PUBLIC_LEGAL_TOS_VERSION || '1.0';

    return (
        <main className="container max-w-3xl mx-auto px-4 py-10">
            <Card>
                <CardHeader>
                    <CardTitle>Terms of Service</CardTitle>
                    <p className="text-sm text-muted-foreground">Version {version}</p>
                </CardHeader>
                <CardContent className="space-y-4 text-sm leading-6 text-muted-foreground">
                    <p>By creating an account, you agree to use QazaQuiz lawfully and not abuse gameplay, payments, or platform integrity.</p>
                    <p>Prize eligibility, account access, and moderation actions may depend on account verification, policy compliance, and fraud checks.</p>
                    <p>These terms are a placeholder page for rollout. Replace with approved legal text before enabling production onboarding.</p>
                </CardContent>
            </Card>
        </main>
    );
}

