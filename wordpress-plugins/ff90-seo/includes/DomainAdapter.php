<?php
namespace FF90\SEO;
/** Domain code has no dependency on WordPress or a specific site. */
interface DomainAdapter {
    public function resolveEntity( string $text ): array;
    public function getEntityRelations( array $entity ): array;
    public function getLandingPageType( array $entity, string $intent ): string;
    public function getIntentRules(): array;
    public function getSchemaExtensions( array $entity ): array;
    public function getInternalLinkTargets( array $entity ): array;
}
