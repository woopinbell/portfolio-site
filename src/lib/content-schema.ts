import { z } from "zod";

// [INTV:ARCH] 이 파일은 src/content/*.json 각각의 "정답 모양"을 zod 스키마로 정의한다 —
// content-loader.ts가 실제 JSON을 읽을 때 이 스키마들로 검증한다. 파일 전체가 몇 가지 zod 메서드의
// 반복이라 여기서 한 번에 정리해두고, 이후 개별 스키마 블록마다 같은 설명을 반복하지 않는다.
// - z.object({...}): 객체의 필드 구성을 정의. 그 뒤에 이어지는 .strict() 또는 .passthrough()가
//   "정의되지 않은 추가 필드를 만나면 어떻게 할지"를 정한다 — .strict()는 그런 필드가 있으면 검증
//   실패(오타 잡기에 유리), .passthrough()는 그냥 통과시키고 결과 객체에 남겨둔다(주로 이 파일
//   하단의 최상위 콘텐츠 스키마들이 나중에 필드가 늘어나도 유연하게 대응하려는 목적).
// - z.array(schema).min(n): 배열이고 원소는 schema를 만족해야 하며 최소 n개 이상이어야 함
// - .optional(): 이 필드가 아예 없어도 통과
// - z.enum([...]): 주어진 문자열 값들 중 하나여야 함 (TS의 문자열 리터럴 유니언과 대응)
// - .regex(pattern, message): 정규식에 맞지 않으면 message를 에러로 보고
// - .refine(fn, message): 위 내장 규칙들로 표현 못 하는 커스텀 검증 로직을 직접 함수로 끼워 넣음
//
// [INTV:ARCH] nonEmptyString/contentId/color는 여러 스키마에서 반복해 쓰이는 "원자적 규칙"을 한
// 곳에 정의해둔 것 — 예를 들어 contentId는 URL이나 React key로도 쓰이는 슬러그(slug) 형태를
// 강제해, 콘텐츠 여기저기서 이 규칙이 제각각 어긋나는 걸 막는다(각 스키마마다 슬러그 정규식을
// 따로 쓰면, 나중에 규칙을 바꿔야 할 때 모든 곳을 일일이 찾아 고쳐야 한다).
const nonEmptyString = z.string().trim().min(1);
const contentId = nonEmptyString.regex(
  /^[a-z0-9]+(?:[a-zA-Z0-9-]*[a-zA-Z0-9])?$/,
  "Use a stable alphanumeric id (hyphens are allowed).",
);
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a six-digit hex color.");

export const contentHrefSchema = nonEmptyString.refine(
  (href) =>
    href.startsWith("/") ||
    href.startsWith("#") ||
    href.startsWith("https://") ||
    href.startsWith("http://") ||
    href.startsWith("mailto:") ||
    href.startsWith("tel:"),
  "Use a root-relative path or an http(s), mailto, or tel URL.",
);

export const contentAssetPathSchema = nonEmptyString.refine(
  (assetPath) =>
    assetPath.startsWith("/content/") || assetPath.startsWith("/template/"),
  "Local assets must live under public/content or public/template.",
);

export const navigationItemSchema = z
  .object({
    label: nonEmptyString,
    href: contentHrefSchema,
  })
  .strict();

export const siteContentSchema = z
  .object({
    title: nonEmptyString,
    description: nonEmptyString,
    language: nonEmptyString,
    brand: nonEmptyString,
    socialImage: contentAssetPathSchema.optional(),
    pages: z
      .object({
        projects: z.boolean(),
        about: z.boolean(),
        resume: z.boolean(),
        contact: z.boolean(),
        journey: z.boolean(),
        interviewMap: z.boolean(),
        curation: z.boolean(),
      })
      .strict()
      .optional(),
    navigation: z.array(navigationItemSchema),
    footer: z
      .object({
        note: nonEmptyString,
        copyright: nonEmptyString,
      })
      .strict(),
  })
  .passthrough();

export const profileContentSchema = z
  .object({
    name: nonEmptyString,
    koreanName: z.string(),
    handle: nonEmptyString,
    role: nonEmptyString,
    headline: nonEmptyString,
    summary: nonEmptyString,
    location: nonEmptyString,
    availability: nonEmptyString,
    photo: z
      .object({
        src: contentAssetPathSchema,
        alt: nonEmptyString,
      })
      .strict()
      .optional(),
    principles: z.array(
      z
        .object({
          title: nonEmptyString,
          body: nonEmptyString,
        })
        .strict(),
    ),
  })
  .strict();

export const linkTypeSchema = z.enum([
  "case-study",
  "demo",
  "email",
  "github",
  "resume",
  "source",
  "website",
]);

export const contentLinkSchema = z
  .object({
    id: contentId.optional(),
    type: linkTypeSchema,
    label: nonEmptyString,
    href: contentHrefSchema,
    external: z.boolean().optional(),
    enabled: z.boolean().optional(),
    placements: z
      .array(z.enum(["hero", "contact", "card", "detail", "footer"]))
      .optional(),
  })
  .strict();

export const deploymentStatusSchema = z.enum([
  "archived",
  "case-study-only",
  "live",
  "offline",
  "private",
  "source-only",
]);

const projectImageSchema = z
  .object({
    src: contentAssetPathSchema,
    alt: nonEmptyString,
  })
  .strict();

export const projectGroupSchema = z
  .object({
    id: contentId,
    label: nonEmptyString,
    description: nonEmptyString,
    order: z.number().int().nonnegative(),
  })
  .strict();

export const projectMetricFilterSchema = z
  .object({
    projectIds: z.array(contentId).min(1).optional(),
    groupIds: z.array(contentId).min(1).optional(),
    tags: z.array(contentId).min(1).optional(),
    featured: z.boolean().optional(),
    deploymentStatuses: z.array(deploymentStatusSchema).min(1).optional(),
  })
  .strict();

export const projectMetricSchema = z
  .object({
    id: contentId,
    label: nonEmptyString,
    description: nonEmptyString.optional(),
    aggregate: z.enum(["projects", "highlights"]),
    filter: projectMetricFilterSchema.optional(),
  })
  .strict();

export const portfolioProjectSourceSchema = z
  .object({
    id: contentId,
    order: nonEmptyString,
    title: nonEmptyString,
    groupId: contentId,
    tags: z.array(contentId),
    featured: z.boolean().optional(),
    enabled: z.boolean().optional(),
    period: nonEmptyString,
    role: nonEmptyString,
    summary: nonEmptyString,
    description: nonEmptyString,
    deployment: z
      .object({
        status: deploymentStatusSchema,
        label: nonEmptyString,
        showBadge: z.boolean().optional(),
      })
      .strict(),
    screenshot: projectImageSchema,
    screenshots: z.array(projectImageSchema),
    stack: z.array(contentId),
    links: z.array(contentLinkSchema),
    highlights: z.array(nonEmptyString),
    problem: nonEmptyString,
    solution: nonEmptyString,
    architecture: z
      .object({
        summary: nonEmptyString,
        items: z.array(nonEmptyString),
      })
      .strict(),
    decisions: z.array(nonEmptyString),
    tradeoffs: z.array(nonEmptyString),
    results: z.array(nonEmptyString),
  })
  .strict();

export const projectsContentSchema = z
  .object({
    groups: z.array(projectGroupSchema).min(1),
    metrics: z.array(projectMetricSchema),
    items: z.array(portfolioProjectSourceSchema).min(1),
  })
  .strict();

const sectionCopySchema = z
  .object({
    actionLabel: nonEmptyString.optional(),
    title: nonEmptyString,
    body: nonEmptyString.optional(),
  })
  .strict();

const homeSectionIdSchema = z.enum([
  "contact",
  "featured",
  "journey",
  "stack",
  "technicalFocus",
  "workMap",
]);

// [INTV:EDGE] .refine으로 "배열 안에 같은 값이 두 번 이상 나오면 안 된다"는 규칙을 직접 구현 —
// Set에 넣었을 때 크기가 줄어들면(중복 제거로 원소 수가 달라지면) 중복이 있었다는 뜻이다. z.enum/
// .min만으로는 이런 "배열 내부 원소 간의 관계" 규칙을 표현할 수 없어 refine이 필요하다. 아래 두
// 상수도 같은 패턴이라 반복 설명하지 않는다.
const editorialHomeSectionsSchema = z
  .array(z.enum(["hero", "lead", "featured", "principles", "contact"]))
  .min(1)
  .refine((sections) => new Set(sections).size === sections.length, {
    message: "Editorial home section IDs must be unique.",
  });

const brutalistHomeSectionsSchema = z
  .array(z.enum(["hero", "signal", "featured", "system", "journey", "contact"]))
  .min(1)
  .refine((sections) => new Set(sections).size === sections.length, {
    message: "Brutalist home section IDs must be unique.",
  });

const cinematicHomeSectionsSchema = z
  .array(z.enum(["hero", "statement", "projects", "focusContact"]))
  .min(1)
  .refine((sections) => new Set(sections).size === sections.length, {
    message: "Cinematic home section IDs must be unique.",
  });

export const siteDesignIdSchema = z.enum([
  "design",
  "classic",
  "editorial",
  "brutalist",
  "cinematic",
]);

const workMapCountKeySchema = z.enum([
  "curriculumCount",
  "productCount",
  "reliabilityCount",
]);

const projectPageCountKeySchema = z.enum([
  "curriculumCount",
  "projectCount",
  "sourceOnlyCount",
]);

const presentationPageTitleSchema = z.object({ title: nonEmptyString }).passthrough();
const eyebrowTitleSchema = z
  .object({ eyebrow: nonEmptyString, title: nonEmptyString })
  .strict();
const projectDetailSectionSchema = eyebrowTitleSchema;
const projectPageContentSchema = z
  .object({
    groups: z.array(
      z.object({ category: nonEmptyString, body: nonEmptyString }).strict(),
    ),
    design: z
      .object({
        hero: z
          .object({
            title: nonEmptyString,
            body: nonEmptyString,
            stats: z
              .object({
                visibleEntries: nonEmptyString,
                archive: nonEmptyString,
                sourceFirst: nonEmptyString,
              })
              .strict(),
          })
          .strict(),
        featured: z
          .object({
            eyebrow: nonEmptyString,
            title: nonEmptyString,
            body: nonEmptyString,
          })
          .strict(),
        group: z.object({ countLabel: nonEmptyString }).strict(),
      })
      .strict(),
    classic: z
      .object({
        hero: z
          .object({
            eyebrow: nonEmptyString,
            title: nonEmptyString,
            body: nonEmptyString,
            stats: z.array(
              z
                .object({
                  label: nonEmptyString,
                  countKey: projectPageCountKeySchema,
                })
                .strict(),
            ),
          })
          .strict(),
        terminal: z
          .object({
            ariaLabel: nonEmptyString,
            title: nonEmptyString,
            promptUser: nonEmptyString,
            promptPath: nonEmptyString,
            command: nonEmptyString,
            entryLabel: nonEmptyString,
            maxGroups: z.number().int().positive(),
          })
          .strict(),
        selected: z
          .object({
            eyebrow: nonEmptyString,
            title: nonEmptyString,
            body: nonEmptyString,
          })
          .strict(),
        grouped: z
          .object({
            eyebrow: nonEmptyString,
            title: nonEmptyString,
            body: nonEmptyString,
            countLabel: nonEmptyString,
          })
          .strict(),
      })
      .strict(),
    editorial: z
      .object({
        hero: z
          .object({ title: nonEmptyString, body: nonEmptyString })
          .strict(),
        archiveAriaLabel: nonEmptyString,
        groupKickerTemplate: nonEmptyString,
      })
      .strict(),
    brutalist: z
      .object({
        hero: z
          .object({
            eyebrow: nonEmptyString,
            title: nonEmptyString,
            body: nonEmptyString,
          })
          .strict(),
      })
      .strict(),
    cinematic: z
      .object({
        hero: z
          .object({
            eyebrow: nonEmptyString,
            entryLabel: nonEmptyString,
            title: nonEmptyString,
            body: nonEmptyString,
          })
          .strict(),
      })
      .strict(),
  })
  .passthrough();

export const presentationContentSchema = z
  .object({
    defaultHomeTemplate: siteDesignIdSchema,
    templates: z.array(
      z
        .object({
          id: siteDesignIdSchema,
          label: nonEmptyString,
          description: nonEmptyString,
        })
        .passthrough(),
    ),
    ui: z
      .object({
        debugPrefix: nonEmptyString,
        skipLinkLabel: nonEmptyString,
        primaryNavigationAriaLabel: nonEmptyString,
        mobileNavigationAriaLabel: nonEmptyString,
        menuLabel: nonEmptyString,
        designSwitcherAriaTemplate: nonEmptyString,
        designSwitcherCountTemplate: nonEmptyString,
        designSwitcherCloseLabel: nonEmptyString,
        designNavigationAriaLabel: nonEmptyString,
        journeyCaseStudyLabel: nonEmptyString,
        techMarqueeAriaLabel: nonEmptyString,
        animatedTerminalAriaLabel: nonEmptyString,
        projectNavigationAriaLabel: nonEmptyString,
        readCaseStudyAriaTemplate: nonEmptyString,
        openItemAriaTemplate: nonEmptyString,
        nowLabel: nonEmptyString,
        emptyStates: z
          .object({
            projectsHome: nonEmptyString,
            projectsArchive: nonEmptyString,
            journey: nonEmptyString,
            projectDetails: nonEmptyString,
            noMappedEvidence: nonEmptyString,
            additionalNotes: nonEmptyString,
            contactLinks: nonEmptyString,
          })
          .strict(),
      })
      .strict(),
    editorial: z
      .object({
        shell: z
          .object({ kicker: nonEmptyString, volumeLabel: nonEmptyString })
          .strict(),
      })
      .strict(),
    brutalist: z
      .object({
        shell: z
          .object({ debugLabel: nonEmptyString, debugHint: nonEmptyString })
          .strict(),
      })
      .strict(),
    cinematic: z
      .object({
        shell: z.object({ brandSubtitle: nonEmptyString }).strict(),
      })
      .strict(),
    home: z
      .object({
        design: z
          .object({
            hero: z
              .object({
                primaryActionLabel: nonEmptyString,
                leadLabel: nonEmptyString,
                leadActionLabel: nonEmptyString,
                stats: z.array(
                  z
                    .object({
                      label: nonEmptyString,
                      countKey: workMapCountKeySchema,
                    })
                    .strict(),
                ),
              })
              .strict(),
            sections: z.array(homeSectionIdSchema),
            featured: sectionCopySchema,
          })
          .strict(),
        classic: z
          .object({
            hero: z.object({ primaryActionLabel: nonEmptyString }).strict(),
            sections: z.array(homeSectionIdSchema),
            featured: sectionCopySchema,
            terminal: z
              .object({
                title: nonEmptyString,
                bootLine: nonEmptyString,
                promptUser: nonEmptyString,
                promptPath: nonEmptyString,
                commands: z.array(
                  z
                    .object({
                      command: nonEmptyString,
                      output: z.array(nonEmptyString),
                    })
                    .strict(),
                ),
              })
              .strict(),
          })
          .strict(),
        editorial: z
          .object({
            sections: editorialHomeSectionsSchema,
            hero: z
              .object({
                issueTemplate: nonEmptyString,
                primaryActionLabel: nonEmptyString,
              })
              .strict(),
            lead: z
              .object({ label: nonEmptyString, actionLabel: nonEmptyString })
              .strict(),
            featured: z.object({ title: nonEmptyString }).strict(),
            current: z.object({ actionLabel: nonEmptyString }).strict(),
          })
          .strict(),
        brutalist: z
          .object({
            sections: brutalistHomeSectionsSchema,
            stampLabel: nonEmptyString,
            signalText: nonEmptyString,
            hero: z
              .object({
                primaryActionLabel: nonEmptyString,
                secondaryActionLabel: nonEmptyString,
              })
              .strict(),
            featured: z
              .object({
                title: nonEmptyString,
                body: nonEmptyString,
                actionLabel: nonEmptyString,
              })
              .strict(),
            system: z
              .object({ title: nonEmptyString, body: nonEmptyString })
              .strict(),
            journeyActionLabel: nonEmptyString,
            contactActionLabel: nonEmptyString,
          })
          .strict(),
        cinematic: z
          .object({
            sections: cinematicHomeSectionsSchema,
            hero: z
              .object({
                primaryActionLabel: nonEmptyString,
                secondaryActionLabel: nonEmptyString,
              })
              .strict(),
            statementLabel: nonEmptyString,
            focusLabel: nonEmptyString,
            contactActionLabel: nonEmptyString,
            caseStudyActionLabel: nonEmptyString,
          })
          .strict(),
        shared: z
          .object({
            workMap: sectionCopySchema.extend({
              cards: z.array(
                z
                  .object({
                    id: contentId,
                    label: nonEmptyString,
                    body: nonEmptyString,
                    countKey: workMapCountKeySchema,
                  })
                  .strict(),
              ),
            }),
            technicalFocus: sectionCopySchema,
            stack: sectionCopySchema,
            journey: sectionCopySchema,
            contact: z
              .object({
                actionLabel: nonEmptyString,
                title: nonEmptyString,
              })
              .strict(),
          })
          .strict(),
      })
      .passthrough(),
    pages: z
      .object({
        about: z
          .object({
            hero: presentationPageTitleSchema,
            principles: presentationPageTitleSchema,
            journey: presentationPageTitleSchema,
            skills: presentationPageTitleSchema,
            curation: presentationPageTitleSchema.extend({
              body: nonEmptyString,
              criteriaTitle: nonEmptyString,
              categoriesTitle: nonEmptyString,
              omissionsTitle: nonEmptyString,
              nextReviewTitle: nonEmptyString,
            }),
            editorial: z
              .object({
                heroEyebrowTemplate: nonEmptyString,
                curationEyebrow: nonEmptyString,
              })
              .strict(),
            brutalist: z
              .object({
                heroEyebrowTemplate: nonEmptyString,
                principleItemLabel: nonEmptyString,
                focusItemLabel: nonEmptyString,
              })
              .strict(),
          })
          .passthrough(),
        contact: z
          .object({
            availability: presentationPageTitleSchema,
            notes: presentationPageTitleSchema,
            editorial: z
              .object({ heroEyebrowTemplate: nonEmptyString })
              .strict(),
            brutalist: z.object({ heroEyebrow: nonEmptyString }).strict(),
          })
          .passthrough(),
        interviewMap: z
          .object({
            hero: z
              .object({ title: nonEmptyString, eyebrow: nonEmptyString })
              .strict(),
            tracks: z
              .object({
                title: nonEmptyString,
                answerLabel: nonEmptyString,
                depthLabel: nonEmptyString,
                referenceLabel: nonEmptyString,
                emptyLabel: nonEmptyString,
                indexLabel: nonEmptyString,
                itemCountTemplate: nonEmptyString,
                questionLabel: nonEmptyString,
              })
              .strict(),
            gaps: z
              .object({ ariaLabel: nonEmptyString, eyebrow: nonEmptyString })
              .strict(),
          })
          .passthrough(),
        journey: z
          .object({
            hero: z
              .object({ title: nonEmptyString, eyebrow: nonEmptyString })
              .strict(),
            narrative: z
              .object({
                title: nonEmptyString,
                body: nonEmptyString,
                labels: z
                  .object({
                    state: nonEmptyString,
                    reason: nonEmptyString,
                    result: nonEmptyString,
                  })
                  .strict(),
              })
              .strict(),
            timeline: z
              .object({ title: nonEmptyString, body: nonEmptyString })
              .strict(),
            now: z
              .object({ title: nonEmptyString, anchorLabel: nonEmptyString })
              .strict(),
          })
          .passthrough(),
        projectDetail: z
          .object({
            backLabel: nonEmptyString,
            caseLabel: nonEmptyString,
            missing: z
              .object({
                eyebrow: nonEmptyString,
                title: nonEmptyString,
                body: nonEmptyString,
                actionLabel: nonEmptyString,
              })
              .strict(),
            facts: z
              .object({ roleLabel: nonEmptyString, statusLabel: nonEmptyString })
              .strict(),
            outroLabel: nonEmptyString,
            returnToIndexLabel: nonEmptyString,
            frameLabel: nonEmptyString,
            editorial: z
              .object({ decisionSpreadTitle: nonEmptyString })
              .strict(),
            sections: z
              .object({
                architecture: projectDetailSectionSchema,
                decisions: projectDetailSectionSchema,
                highlights: projectDetailSectionSchema,
                problem: projectDetailSectionSchema,
                result: projectDetailSectionSchema,
                screenshots: projectDetailSectionSchema,
                solution: projectDetailSectionSchema,
                stack: projectDetailSectionSchema,
                tradeoffs: projectDetailSectionSchema,
              })
              .strict(),
          })
          .passthrough(),
        projects: projectPageContentSchema,
        resume: z
          .object({
            hero: z
              .object({
                title: nonEmptyString,
                body: nonEmptyString,
                downloadLabel: nonEmptyString,
              })
              .strict(),
            summary: presentationPageTitleSchema,
            projects: z
              .object({
                title: nonEmptyString,
                caseStudyLabel: nonEmptyString,
              })
              .strict(),
            training: presentationPageTitleSchema,
            experience: presentationPageTitleSchema,
            education: presentationPageTitleSchema,
            notes: presentationPageTitleSchema,
            identity: z
              .object({
                locationLabel: nonEmptyString,
                availabilityLabel: nonEmptyString,
              })
              .strict(),
            editorial: z.object({ heroEyebrow: nonEmptyString }).strict(),
            brutalist: z
              .object({ heroEyebrowTemplate: nonEmptyString })
              .strict(),
          })
          .passthrough(),
      })
      .passthrough(),
  })
  .passthrough();

export const techStackIconSchema = z.enum([
  "api",
  "box",
  "c",
  "check",
  "cmake",
  "cplusplus",
  "database",
  "docker",
  "eslint",
  "flow",
  "json",
  "nextjs",
  "nodejs",
  "playwright",
  "postgresql",
  "prisma",
  "react",
  "redis",
  "shield",
  "tailwind",
  "terminal",
  "tool",
  "typescript",
  "vitest",
]);

export const techStackContentSchema = z.array(
  z
    .object({
      id: contentId,
      label: nonEmptyString,
      icon: techStackIconSchema,
      color,
    })
    .strict(),
);

export const skillsContentSchema = z
  .object({
    focusAreas: z.array(
      z.object({ title: nonEmptyString, body: nonEmptyString }).strict(),
    ),
    groups: z.array(
      z.object({ title: nonEmptyString, items: z.array(nonEmptyString) }).strict(),
    ),
  })
  .strict();

export const experienceContentSchema = z.array(
  z
    .object({
      period: nonEmptyString,
      title: nonEmptyString,
      body: nonEmptyString,
    })
    .strict(),
);

export const journeyContentSchema = z.array(
  z
    .object({
      date: nonEmptyString,
      endDate: nonEmptyString.nullable(),
      title: nonEmptyString,
      category: nonEmptyString,
      body: nonEmptyString,
      projectId: contentId.nullable(),
      sourcePath: nonEmptyString.nullable(),
    })
    .strict(),
);

export const linksContentSchema = z.array(contentLinkSchema);

export const contactContentSchema = z
  .object({
    title: nonEmptyString,
    intro: nonEmptyString,
    availability: nonEmptyString,
    preferred: z.array(contentId),
    notes: z.array(nonEmptyString),
  })
  .strict();

export const resumeContentSchema = z
  .object({
    downloadUrl: contentAssetPathSchema.nullable(),
    summary: z.array(nonEmptyString),
    projectIds: z.array(contentId),
    training: z.array(
      z
        .object({
          name: nonEmptyString,
          period: nonEmptyString,
          description: nonEmptyString,
        })
        .strict(),
    ),
    education: z.array(
      z
        .object({
          name: nonEmptyString,
          period: nonEmptyString,
          description: nonEmptyString,
        })
        .strict(),
    ),
    notes: z.array(nonEmptyString),
  })
  .strict();

export const journeyNarrativeContentSchema = z
  .object({
    intro: nonEmptyString,
    milestones: z.array(
      z
        .object({
          id: contentId,
          date: nonEmptyString,
          title: nonEmptyString,
          state: nonEmptyString,
          reason: nonEmptyString,
          result: nonEmptyString,
          anchorProjectIds: z.array(contentId),
        })
        .strict(),
    ),
    currentPosition: z
      .object({ title: nonEmptyString, body: nonEmptyString })
      .strict(),
  })
  .strict();

export const interviewMapContentSchema = z
  .object({
    intro: nonEmptyString,
    referenceRepo: z
      .object({ label: nonEmptyString, href: contentHrefSchema })
      .strict(),
    tracks: z.array(
      z
        .object({
          id: contentId,
          label: nonEmptyString,
          body: nonEmptyString,
          items: z.array(
            z
              .object({
                label: nonEmptyString,
                reference: contentHrefSchema,
                answers: z.array(
                  z
                    .object({
                      projectId: contentId,
                      depth: nonEmptyString,
                    })
                    .strict(),
                ),
              })
              .strict(),
          ),
        })
        .strict(),
    ),
    gaps: z
      .object({
        title: nonEmptyString,
        body: nonEmptyString,
        items: z.array(nonEmptyString),
      })
      .strict(),
  })
  .strict();

export const curationContentSchema = z
  .object({
    intro: nonEmptyString,
    criteria: z
      .object({
        title: nonEmptyString,
        items: z.array(
          z.object({ title: nonEmptyString, body: nonEmptyString }).strict(),
        ),
      })
      .strict(),
    categories: z.array(
      z
        .object({
          id: contentId,
          label: nonEmptyString,
          rationale: nonEmptyString,
          projectIds: z.array(contentId),
        })
        .strict(),
    ),
    omissions: z
      .object({
        title: nonEmptyString,
        body: nonEmptyString,
        items: z.array(
          z.object({ title: nonEmptyString, body: nonEmptyString }).strict(),
        ),
      })
      .strict(),
    nextReview: z
      .object({ title: nonEmptyString, body: nonEmptyString })
      .strict(),
  })
  .strict();

// [INTV:ARCH] z.infer<typeof schema>: zod 스키마 "값"으로부터 그 스키마가 검증을 통과시킨 데이터의
// TS "타입"을 역으로 추출하는 문법 — 스키마와 타입을 따로 두 번 작성하지 않고 스키마 하나만 진짜
// 소스로 두는 방식이다. 이렇게 뽑아낸 타입들을 lib/portfolio/types.ts가 다시 가져다 쓴다 — 결국
// "콘텐츠가 실제로 어떤 모양이어야 하는지"의 최종 근거는 이 파일의 zod 스키마이고, 나머지 타입들은
// 전부 여기서 파생된다.
export type ProjectGroup = z.infer<typeof projectGroupSchema>;
export type ProjectMetric = z.infer<typeof projectMetricSchema>;
export type ProjectMetricFilter = z.infer<typeof projectMetricFilterSchema>;
export type PortfolioProjectSource = z.infer<
  typeof portfolioProjectSourceSchema
>;
export type ProjectsContentSource = z.infer<typeof projectsContentSchema>;
export type PresentationContentSource = z.infer<
  typeof presentationContentSchema
>;
