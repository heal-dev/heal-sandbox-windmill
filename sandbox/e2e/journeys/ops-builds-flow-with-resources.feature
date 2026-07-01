@journey @journey:ops-builds-flow-with-resources @worker
Feature: An ops engineer composes a resource+variable-driven flow and fires it via an HTTP route
  As an ops-minded developer signed in to the seeded 'admins' workspace,
  I want to add a Resource and a Variable, deploy a Python script that consumes both,
  compose a 2-step flow that calls that script, expose the flow via an HTTP route,
  fire the route, and inspect the resulting job,
  So that I can prove the full configure -> compose -> trigger -> inspect loop works end-to-end.

  Background:
    Given I am signed in as "admin@windmill.dev" in workspace "admins"
    And a 'c_config'-shaped resource type already exists in the workspace        # seeded via API (admins workspace ships with zero resource_types)

  Scenario: From resource + variable to a flow fired by an HTTP route
    When I navigate to "/resources" from the sidebar
    And I click the "Add resource" button
    And I select the seeded resource type
    And I fill the resource Path with "u/admin/ops-cfg-<rand>"
    And I fill the schema field "region" with "eu-west-1"
    And I click the "Save" button                                                # produces: resourcePath
    Then a row with the resource path is visible on /resources

    When I navigate to "/variables" from the sidebar
    And I click the "New variable" button
    And I fill the variable Path suffix with "ops-var-<rand>"
    And I disable the "Secret" toggle
    And I fill the variable value with "prod"
    And I click the "Save" button                                                # produces: variablePath
    Then a row with the variable path is visible on /variables

    When the harness deploys a Python script via the API                         # api-shortcut per walkNote (Monaco is fragile)
      """
      import wmill
      def main():
          cfg = wmill.get_resource('<resourcePath>')
          env = wmill.get_variable('<variablePath>')
          return {'region': cfg['region'], 'env': env}
      """
    And I navigate to "/scripts/get/<scriptPath>"                                # produces: scriptPath
    Then the script detail page is visible

    When the harness deploys a 2-step flow via the API                           # api-shortcut per walkNote (FlowBuilder drag-drop is fragile)
    And I navigate to "/flows/get/<flowPath>"                                    # produces: flowPath
    Then the flow detail page is visible
    And the FlowGraphViewer shows the two step ids

    When I navigate to "/routes" from the sidebar
    Then the page heading reads "Custom HTTP routes"
    And the "New route" button is visible

    When the harness creates an HTTP route via the API                           # api-shortcut per walkNote (RouteEditor drawer is fragile)
    And I reload "/routes"                                                       # produces: routePath
    Then a row with the route path is visible on /routes

    When the harness POSTs to "/api/r/admins/<routePath>" with empty JSON        # api-shortcut: no /routes UI affordance to fire a route
    Then the response is 2xx                                                     # produces: jobId
    And the response body surfaces the resource + variable values

    When I navigate to "/runs" from the sidebar
    Then the page heading reads "Runs"
    And a row referencing the flow path appears in the Runs table

    When I navigate to "/run/<jobId>" with workspace "admins"
    Then the job detail page is visible
    And the result panel surfaces "eu-west-1" and "prod"
