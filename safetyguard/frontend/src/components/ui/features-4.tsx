import { Cpu, Fingerprint, Pencil, Settings2, Sparkles, Zap } from 'lucide-react'

export function Features() {
    return (
        <section className="py-12 md:py-20">
            <div className="mx-auto max-w-5xl space-y-8 px-6 md:space-y-16">
                <div className="relative z-10 mx-auto max-w-xl space-y-6 text-center md:space-y-12">
                    <h2 className="text-balance text-4xl font-medium lg:text-5xl">Built for teams shipping AI at scale</h2>
                    <p className="text-muted-foreground">SafetyGuard provides a comprehensive multi-agent analysis system to help engineering teams identify vulnerabilities, hallucinations, and risks across every dimension of their AI stack.</p>
                </div>

                <div className="relative mx-auto grid max-w-2xl lg:max-w-4xl divide-x divide-y border *:p-12 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <Zap className="size-4 text-primary" />
                            <h3 className="text-sm font-medium">Instant Analysis</h3>
                        </div>
                        <p className="text-sm text-muted-foreground">Point at any repo and get a full safety audit in minutes, not weeks.</p>
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <Cpu className="size-4 text-primary" />
                            <h3 className="text-sm font-medium">Multi-Agent System</h3>
                        </div>
                        <p className="text-sm text-muted-foreground">10 specialized agents analyze security, privacy, cost, hallucination, and more in parallel.</p>
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <Fingerprint className="size-4 text-primary" />
                            <h3 className="text-sm font-medium">Privacy & Security</h3>
                        </div>
                        <p className="text-sm text-muted-foreground">Deep scans for credential leaks, PII exposure, and attack surfaces in your AI pipelines.</p>
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <Pencil className="size-4 text-primary" />
                            <h3 className="text-sm font-medium">Actionable Reports</h3>
                        </div>
                        <p className="text-sm text-muted-foreground">Every finding comes with severity scores, evidence, and concrete fix suggestions.</p>
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <Settings2 className="size-4 text-primary" />
                            <h3 className="text-sm font-medium">CI/CD Ready</h3>
                        </div>
                        <p className="text-sm text-muted-foreground">Integrate with GitHub Actions and webhooks to gate deployments on safety thresholds.</p>
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <Sparkles className="size-4 text-primary" />
                            <h3 className="text-sm font-medium">Open-Source LLMs</h3>
                        </div>
                        <p className="text-sm text-muted-foreground">Powered by Featherless AI and open-source models — no vendor lock-in required.</p>
                    </div>
                </div>
            </div>
        </section>
    )
}
