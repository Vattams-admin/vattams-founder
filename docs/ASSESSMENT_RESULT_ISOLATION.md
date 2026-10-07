# Assessment Result Isolation

Assessment result access is server-authoritative. Firebase identity is verified at the Edge Function boundary, the requested attempt is bound to that authenticated student ID, and only submitted attempts have a result.

Direct client access to `assessment_attempts`, `assessment_answers`, and `assessment_results` remains revoked. The result RPC is `SECURITY DEFINER` and executable only by `service_role`.

A different student's attempt ID therefore cannot be used to retrieve another student's result or review data.