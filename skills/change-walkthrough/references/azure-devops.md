# Azure DevOps comparisons and file links

A PR summary may expose commit SHAs and an iterations link without returning
the iterations themselves. Missing fields are not evidence that iterations
are unavailable. Read the iterations collection before choosing a fallback.

Use the PR's `_links.iterations.href`, or this read-only API:

```text
GET https://dev.azure.com/{organization}/{project}/_apis/git/repositories/{repositoryId}/pullRequests/{pullRequestId}/iterations?api-version=7.1
```

With an authenticated Azure CLI, the equivalent is:

```powershell
az devops invoke --organization https://dev.azure.com/{organization} --area git --resource pullRequestIterations --route-parameters project={project} repositoryId={repositoryId} pullRequestId={pullRequestId} --api-version 7.1 --output json
```

Choose the returned iteration whose `sourceRefCommit.commitId` matches the
reviewed source. For the whole PR, use its `commonRefCommit.commitId` as the
comparison base. For a completed PR, retain the final historical source and
common base, not today's branch tips or an individual feature commit.

Link changed files through the PR Files view:

```text
{PR web URL}?_a=files&path={URL-encoded repository-absolute path}&iteration={verified iteration ID}&base=0
```

This is the whole-PR comparison, not the difference from the previous push.
For explicitly requested between-iteration reviews, use the verified earlier
iteration ID as `base` instead. Preserve renamed/deleted paths from the
comparison metadata rather than inventing a path.

The iteration changes API can establish which files belong to that comparison:
`iterations/{iterationId}/changes?$compareTo=0&api-version=7.1`.
Here `$compareTo=0` means the source/target common commit, as documented in
[Microsoft Learn](https://learn.microsoft.com/en-us/rest/api/azure/devops/git/pull-request-iteration-changes/get?view=azure-devops-rest-7.1).

If access fails, explain the actual limitation and label any source fallback
as "full file", not "PR diff". API metadata verifies comparison IDs and paths;
it does not prove browser navigation. Only claim click-through verification
when the destination was actually observed.
