defmodule SolardocPhoenixWeb.Router do
  @moduledoc false
  use SolardocPhoenixWeb, :router

  import SolardocPhoenixWeb.UserAuth

  pipeline :browser do
    plug :accepts, ["html"]
    plug :fetch_session
    plug :fetch_live_flash
    plug :put_root_layout, html: {SolardocPhoenixWeb.Layouts, :root}
    plug :put_secure_browser_headers
    plug :protect_from_forgery
    plug :fetch_current_user
  end

  pipeline :api do
    plug :accepts, ["json"]
    plug :put_secure_browser_headers
    plug :fetch_api_user
  end

  pipeline :api_auth do
    plug :require_api_user
  end

  # Enable LiveDashboard, Swagger Dashboard and Swoosh mailbox preview in development
  if Application.compile_env(:solardoc_phoenix, :dev_routes) do
    # If you want to use the LiveDashboard in production, you should put
    # it behind authentication and allow only admins to access it.
    # If your application does not have an admins-only section yet,
    # you can use Plug.BasicAuth to set up some basic authentication
    # as long as you are also using SSL (which you should anyway).
    import Phoenix.LiveDashboard.Router

    scope "/dev" do
      pipe_through :browser

      live_dashboard "/dashboard", metrics: SolardocPhoenixWeb.Telemetry
      forward "/mailbox", Plug.Swoosh.MailboxPreview
    end

    scope "/phx/api/swagger" do
      forward "/", PhoenixSwagger.Plug.SwaggerUI, otp_app: :solardoc_phoenix, swagger_file: "swagger.json"
    end
  end

  # Index page with a simple message
  scope "/phx", SolardocPhoenixWeb do
    pipe_through :api

    get "/", V2.HomeController, :index
  end

  ########## - v1 API - ##########

  scope "/phx/api/v2", SolardocPhoenixWeb do
    pipe_through :api

    # Ping route
    get "/ping", V2.PingController, :index

    # User registration and password reset routes
    post "/users", V2.UserController, :create
    post "/users/reset_password", V2.UserResetPasswordController, :create
    put "/users/reset_password/:token", V2.UserResetPasswordController, :update

    # Solardoc Auth API - Bearer token authentication
    post "/auth/bearer", V2.UserAuthController, :create
  end

  # User routes requiring authentication
  # (This may also include routes which actually don't need authentication, but are only accessible to authenticated
  # users to avoid spam or other abuse)
  scope "/phx/api/v2", SolardocPhoenixWeb do
    pipe_through [:api, :api_auth]

    # User routes
    get "/users", V2.UserController, :index
    get "/users/current", V2.UserController, :current

    # User confirmation routes
    # credo:disable-for-next-line
    # TODO! Finish the migration from the old user confirmation controller to the new API-only controller
    # post "/users/confirm", V2.UserConfirmationController, :create
    # post "/users/confirm/:token", V2.UserConfirmationController, :update

    # User settings routes
    # credo:disable-for-next-line
    # TODO! Finish the migration from the old user settings controller to the new API-only controller
    # put "/users/settings", V2.UserSettingsController, :update
    # get "/users/settings/confirm_email/:token", V2.UserSettingsController, :confirm_email

    # Channel routes
    resources "/editor_channels", V2.EditorChannelController, only: [:index, :show, :update]

    # Solardoc Auth API - Logging out i.e. deleting the user bearer token
    delete "/auth/bearer", V2.UserAuthController, :delete

    # File routes
    get "/files", V2.FileController, :index
    get "/files/global", V2.FileController, :global
    get "/files/:id", V2.FileController, :show
    post "/files", V2.FileController, :create
    put "/files/:id", V2.FileController, :update
    delete "/files/:id", V2.FileController, :delete

    # Share URL routes
    get "/share/:id", V2.ShareURLController, :show_share
    get "/share/:id/file", V2.ShareURLController, :show_file
    get "/share/:id/channel", V2.ShareURLController, :show_channel
    delete "/share/:id", V2.ShareURLController, :delete
    post "/share", V2.ShareURLController, :create

    #File Permission routes
    post "/files/permissions", V2.FilePermissionController, :create
    get "/files/permissions/:id", V2.FilePermissionController, :show
    put "/files/permissions/:id", V2.FilePermissionController, :update
    get "/files/:file_id/permissions/:user_id", V2.FilePermissionController, :show_permission_for_user
    get "/files/:file_id/permissions", V2.FilePermissionController, :show_permissions_for_file
  end

  ########## - General API Info - ##########

  def swagger_info do
    %{
      basePath: "/phx/api",
      schemes: ["http", "https", "ws", "wss"],
      info: %{
        version: SolardocPhoenixWeb.version(),
        title: "@solardoc/phoenix",
        description: "The Solardoc Phoenix Rest API and SDS (Solardoc Socket)",
        license: %{
          name: "GNU General Public License v3.0",
          url: "https://github.com/SYP-AHIF-2023-24-25/SolarDoc/blob/main/LICENSE",
        },
        contact: %{
          name: "Luna Klatzer, Emma Walchshofer & Lisa Pichler",
        }
      },
      securityDefinitions: %{
        Bearer: %{
          type: "apiKey",
          name: "Authorization",
          in: "header",
          description: "API Token must be provided via `Authorization: Bearer ` header",
        }
      },
      consumes: ["application/json"],
      produces: ["application/json"],
      tags: [
        %{name: "User", description: "User resources"},
        %{name: "UserAuth", description: "User authentication resources"},
        %{name: "UserConfirmation", description: "User confirmation resources"},
        %{name: "UserSettings", description: "User settings resources"},
        %{name: "EditorChannel", description: "Editor channel resources"},
        %{name: "File", description: "File resources"},
        %{name: "ShareURL", description: "Share URL resources"},
        %{name: "FilePermission", description: "File Permission resources"},
      ]
    }
  end
end
