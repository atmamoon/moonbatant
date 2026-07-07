// analytics.js — anonymous usage analytics via PostHog.
//
// Privacy contract (also stated in the README):
//   • No logins, no accounts, no PII. Nothing here identifies a person.
//   • The only identifier is PostHog's random anonymous id in this browser's
//     localStorage — used solely to count daily active users.
//   • Autocapture and session recording are OFF; only the explicit events sent
//     via track() below exist (test_started, question_answered, test_completed).
//   • Do-Not-Track is respected, and nothing is ever sent when running locally.
// Self-hosting? Delete POSTHOG_KEY (or the initAnalytics() call in app.js) and
// the app runs with zero telemetry.

const POSTHOG_KEY = 'phc_AGCpstJm3x2tY5LhLagAwzKSEHaZYyTr7utRdTUwWpFr';
const POSTHOG_HOST = 'https://us.i.posthog.com';

const isLocal = location.protocol === 'file:'
  || ['localhost', '127.0.0.1', '0.0.0.0', '[::1]'].includes(location.hostname);
const dnt = navigator.doNotTrack === '1' || window.doNotTrack === '1';

let enabled = false;

export function initAnalytics() {
  if (isLocal || dnt || !POSTHOG_KEY) return;
  try {
    /* Official PostHog loader stub — queues calls until array.js arrives. */
    !(function (t, e) {
      var o, n, p, r;
      e.__SV ||
        ((window.posthog = e),
        (e._i = []),
        (e.init = function (i, s, a) {
          function g(t, e) {
            var o = e.split('.');
            (2 == o.length && ((t = t[o[0]]), (e = o[1])),
              (t[e] = function () {
                t.push([e].concat(Array.prototype.slice.call(arguments, 0)));
              }));
          }
          (((p = t.createElement('script')).type = 'text/javascript'),
            (p.crossOrigin = 'anonymous'),
            (p.async = !0),
            (p.src =
              s.api_host.replace('.i.posthog.com', '-assets.i.posthog.com') + '/static/array.js'),
            (r = t.getElementsByTagName('script')[0]).parentNode.insertBefore(p, r));
          var u = e;
          for (
            void 0 !== a ? (u = e[a] = []) : (a = 'posthog'),
              u.people = u.people || [],
              u.toString = function (t) {
                var e = 'posthog';
                return ('posthog' !== a && (e += '.' + a), t || (e += ' (stub)'), e);
              },
              u.people.toString = function () {
                return u.toString(1) + '.people (stub)';
              },
              o =
                'init capture register register_once register_for_session unregister unregister_for_session getFeatureFlag getFeatureFlagResult isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey getNextSurveyStep identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty createPersonProfile opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing debug'.split(
                  ' ',
                ),
              n = 0;
            n < o.length;
            n++
          )
            g(u, o[n]);
          e._i.push([i, s, a]);
        }),
        (e.__SV = 1));
    })(document, window.posthog || []);

    window.posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      defaults: '2026-05-30',
      person_profiles: 'identified_only', // identify() is never called → every event stays anonymous
      autocapture: false,
      disable_session_recording: true,
      respect_dnt: true,
      persistence: 'localStorage',
    });
    enabled = true;
  } catch { /* analytics must never break the app */ }
}

export function track(event, props = {}) {
  if (!enabled) return;
  try { window.posthog.capture(event, props); } catch { /* ignore */ }
}
