# Nutrition

A PWA for logging what one Member eats against their daily Targets, with every Log Entry pushed to
Google Health. The third app on the data platform
([nadav-alon/data-platform](https://github.com/nadav-alon/data-platform)), sharing the Household with
the home catalogue and recipes. Platform terms (Household, Member, Soft delete, Food, Nutrition, Log
Entry, Targets) are defined in the platform's `CONTEXT.md` and used here unchanged.

## Language

**Nutrition**:
The macros of some amount of food: kcal, protein, carbs and fat. A value other records carry, never
a thing of its own.
_Avoid_: macros (as a noun for the record), nutrients

**Food**:
A dish or product the Household has saved that is not a Recipe ("canteen schnitzel"), with the
Nutrition of one Serving. Edited only in this app.
_Avoid_: meal, item, product

**Serving**:
One portion of a Food, as its serving label describes it ("1 plate"). Log Entries count in
Servings, fractions allowed.
_Avoid_: portion, unit

**Estimated**:
Said of a Food, or of a Quick Entry not saved as a Food, whose Nutrition is a guess rather than read off a label or source.
_Avoid_: approximate, guessed

**Log Entry**:
One thing the Member ate: when, which Meal Type, how many Servings, and a snapshot of its name and
Nutrition totals, so editing a Food later never rewrites what was logged.
_Avoid_: meal, record, diary entry

**Quick Entry**:
A Log Entry with no saved Food behind it: a name and Nutrition typed once.
_Avoid_: one-off, ad-hoc entry

**Estimate link**:
A `#/log?…` link, carrying a name, place, per-Serving Nutrition and an Estimated flag, that opens the Log screen's Quick Entry form prefilled. Nothing is saved until the Member saves.
_Avoid_: deep link, prefill link

**Recents**:
The last distinct things the Member logged, Foods and Quick Entries alike, offered for logging again.
Logging a Quick Entry again makes a new Quick Entry with the same name, Nutrition and Estimated flag.
_Avoid_: history, favourites

**Meal Type**:
Breakfast, lunch, dinner or snack. Guessed from the local time eaten (before 11:00 breakfast, before
16:00 lunch, until 21:30 dinner, after that snack), always editable.
_Avoid_: meal, category

**Day**:
A local calendar day, midnight to midnight. A Log Entry belongs to the Day its eaten time falls in;
the app shows one Day at a time, today by default, and steps to earlier ones.
_Avoid_: date, diary page

**Targets**:
The Member's daily goals for kcal, protein, carbs and fat, each optional. Private to that Member,
and independent of Google Health's own goals.
_Avoid_: goals, budget, limits
