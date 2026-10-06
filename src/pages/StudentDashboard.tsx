              </Link>
            ))}
          </div>
        )}
      </section>
      <section className="mt-8">
        <h2 className="font-display text-xl text-gold-bright">Enrolled courses</h2>
        {enrolmentsState === 'loading' && <p className="mt-2 text-sm text-slate-muted">Loading…</p>}
        {enrolmentsState === 'error' && (
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <p className="text-sm text-danger">
              Unable to connect right now. Please check your internet connection and try again.
            </p>
            {enrolmentsError && (