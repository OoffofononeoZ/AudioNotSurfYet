export interface ExpectedEvent {category:string;pitch?:number;startSeconds:number;endSeconds?:number}
export interface ObservedEvent extends ExpectedEvent {}
// The association window is an analysis convention, not an acceptance gate.
// Preserve every raw observation so missed, extra and misclassified events can
// be reviewed using a different matching convention.
export function assessEvents(expected:readonly ExpectedEvent[],observed:readonly ObservedEvent[],associationSeconds=.12) {
    const remaining = new Set(observed.map((_,index) => index));
    const matches:Array<{expected:ExpectedEvent;observed:ObservedEvent;classificationError:boolean;pitchError:number|null;startErrorSeconds:number;endErrorSeconds:number|null}> = [];
    const missed:ExpectedEvent[] = [];
    for (const event of [...expected].sort((a,b) => a.startSeconds-b.startSeconds)) {
        const nearby = [...remaining].filter(index => Math.abs(observed[index]!.startSeconds-event.startSeconds) <= associationSeconds);
        nearby.sort((a,b) => {
            const score = (index:number) => (observed[index]!.category === event.category ? 0 : 10)+(observed[index]!.pitch === event.pitch ? 0 : 1)+Math.abs(observed[index]!.startSeconds-event.startSeconds);
            return score(a)-score(b);
        });
        const index = nearby[0];if (index === undefined) { missed.push(event);continue; }remaining.delete(index);const actual = observed[index]!;
        matches.push({expected:event,observed:actual,classificationError:actual.category !== event.category,pitchError:event.pitch === undefined || actual.pitch === undefined ? null : actual.pitch-event.pitch,
            startErrorSeconds:actual.startSeconds-event.startSeconds,endErrorSeconds:event.endSeconds === undefined || actual.endSeconds === undefined ? null : actual.endSeconds-event.endSeconds});
    }
    return {associationSeconds,expectedCount:expected.length,observedCount:observed.length,matchedCount:matches.length,
        classificationErrors:matches.filter(match => match.classificationError).length,pitchErrors:matches.filter(match => match.pitchError !== null && match.pitchError !== 0).length,
        missedCount:missed.length,extraCount:remaining.size,matches,missed,extra:[...remaining].map(index => observed[index]!)};
}
